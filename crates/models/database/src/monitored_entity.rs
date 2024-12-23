//! `SeaORM` Entity. Generated by sea-orm-codegen 0.11.2

use enum_models::EntityLot;
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "monitored_entity")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub user_id: String,
    #[sea_orm(primary_key, auto_increment = false)]
    pub entity_id: String,
    #[sea_orm(primary_key, auto_increment = false)]
    pub entity_lot: EntityLot,
    pub origin_collection_id: String,
    pub collection_to_entity_id: Uuid,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
