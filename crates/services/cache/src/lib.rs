use std::sync::Arc;

use async_graphql::Result;
use chrono::{Duration, Utc};
use common_models::ApplicationCacheKey;
use common_utils::ryot_log;
use database_models::{application_cache, prelude::ApplicationCache};
use dependent_models::ApplicationCacheValue;
use sea_orm::{ActiveValue, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use sea_query::OnConflict;
use serde::de::DeserializeOwned;
use uuid::Uuid;

pub struct CacheService {
    db: DatabaseConnection,
    config: Arc<config::AppConfig>,
}

impl CacheService {
    pub fn new(db: &DatabaseConnection, config: Arc<config::AppConfig>) -> Self {
        Self {
            config,
            db: db.clone(),
        }
    }
}

impl CacheService {
    fn get_expiry_for_key(&self, key: &ApplicationCacheKey) -> Option<i64> {
        match key {
            ApplicationCacheKey::IgdbSettings
            | ApplicationCacheKey::ListennotesSettings
            | ApplicationCacheKey::TmdbSettings => None,

            ApplicationCacheKey::CoreDetails
            | ApplicationCacheKey::PeopleSearch { .. }
            | ApplicationCacheKey::MetadataSearch { .. }
            | ApplicationCacheKey::MetadataGroupSearch { .. }
            | ApplicationCacheKey::MetadataRecentlyConsumed { .. } => Some(1),

            ApplicationCacheKey::UserAnalytics { .. } => Some(2),

            ApplicationCacheKey::UserCollectionsList { .. }
            | ApplicationCacheKey::UserAnalyticsParameters { .. } => Some(8),

            ApplicationCacheKey::ProgressUpdateCache { .. } => {
                Some(self.config.server.progress_update_threshold)
            }
        }
    }

    pub async fn set_key(
        &self,
        key: ApplicationCacheKey,
        value: ApplicationCacheValue,
    ) -> Result<Uuid> {
        let now = Utc::now();
        let expiry_hours = self.get_expiry_for_key(&key);
        let to_insert = application_cache::ActiveModel {
            key: ActiveValue::Set(key),
            created_at: ActiveValue::Set(now),
            value: ActiveValue::Set(serde_json::to_value(value)?),
            expires_at: ActiveValue::Set(expiry_hours.map(|hours| now + Duration::hours(hours))),
            ..Default::default()
        };
        let inserted = ApplicationCache::insert(to_insert)
            .on_conflict(
                OnConflict::column(application_cache::Column::Key)
                    .update_columns([
                        application_cache::Column::Value,
                        application_cache::Column::ExpiresAt,
                        application_cache::Column::CreatedAt,
                    ])
                    .to_owned(),
            )
            .exec(&self.db)
            .await?;
        let insert_id = inserted.last_insert_id;
        ryot_log!(debug, "Inserted application cache with id = {insert_id:?}");
        Ok(insert_id)
    }

    pub async fn get_value<T: DeserializeOwned>(&self, key: ApplicationCacheKey) -> Option<T> {
        let cache = ApplicationCache::find()
            .filter(application_cache::Column::Key.eq(key.clone()))
            .one(&self.db)
            .await
            .ok()?;
        let db_value = cache
            .filter(|cache| {
                cache
                    .expires_at
                    .map_or(true, |expires_at| expires_at > Utc::now())
            })
            .map(|m| m.value)?;
        serde_json::from_value::<T>(db_value).ok()
    }

    pub async fn expire_key(&self, key: ApplicationCacheKey) -> Result<bool> {
        let deleted = ApplicationCache::update_many()
            .filter(application_cache::Column::Key.eq(key))
            .set(application_cache::ActiveModel {
                expires_at: ActiveValue::Set(Some(Utc::now())),
                ..Default::default()
            })
            .exec(&self.db)
            .await?;
        Ok(deleted.rows_affected > 0)
    }
}
