//! `SeaORM` Entity. Generated by sea-orm-codegen 0.12.14

use async_graphql::SimpleObject;
use enum_models::UserToMediaReason;
use fitness_models::UserToExerciseExtraInformation;
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize, SimpleObject)]
#[sea_orm(table_name = "user_to_entity")]
#[graphql(name = "UserToEntity")]
pub struct Model {
    #[sea_orm(primary_key)]
    #[graphql(skip)]
    pub id: Uuid,
    pub created_on: DateTimeUtc,
    pub last_updated_on: DateTimeUtc,
    pub user_id: String,
    pub person_id: Option<String>,
    pub metadata_id: Option<String>,
    pub exercise_id: Option<String>,
    pub collection_id: Option<String>,
    pub exercise_extra_information: Option<UserToExerciseExtraInformation>,
    pub exercise_num_times_interacted: Option<i32>,
    #[graphql(skip)]
    pub media_reason: Option<Vec<UserToMediaReason>>,
    #[graphql(skip)]
    pub needs_to_be_updated: Option<bool>,
    pub metadata_group_id: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::collection::Entity",
        from = "Column::CollectionId",
        to = "super::collection::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    Collection,
    #[sea_orm(
        belongs_to = "super::exercise::Entity",
        from = "Column::ExerciseId",
        to = "super::exercise::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    Exercise,
    #[sea_orm(
        belongs_to = "super::metadata::Entity",
        from = "Column::MetadataId",
        to = "super::metadata::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    Metadata,
    #[sea_orm(
        belongs_to = "super::metadata_group::Entity",
        from = "Column::MetadataGroupId",
        to = "super::metadata_group::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    MetadataGroup,
    #[sea_orm(
        belongs_to = "super::person::Entity",
        from = "Column::PersonId",
        to = "super::person::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    Person,
    #[sea_orm(
        belongs_to = "super::user::Entity",
        from = "Column::UserId",
        to = "super::user::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    User,
}

impl Related<super::collection::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Collection.def()
    }
}

impl Related<super::exercise::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Exercise.def()
    }
}

impl Related<super::metadata::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Metadata.def()
    }
}

impl Related<super::metadata_group::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::MetadataGroup.def()
    }
}

impl Related<super::person::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Person.def()
    }
}

impl Related<super::user::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::User.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
