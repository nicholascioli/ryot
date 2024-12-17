use chrono::DateTime;
use chrono_tz::Tz;
use database_models::seen;
use enums::{MediaLot, MediaSource};
use fitness_models::GithubExercise;
use media_models::{DeployImportJobInput, ProgressUpdateInput, ReviewPostedEvent};
use serde::{Deserialize, Serialize};
use strum::Display;
use uuid::Uuid;

// The background jobs which cannot be throttled.
#[derive(Debug, Deserialize, Serialize, Display)]
pub enum CoreApplicationJob {
    SyncIntegrationsData(String),
    ReviewPosted(ReviewPostedEvent),
    BulkProgressUpdate(String, Vec<ProgressUpdateInput>),
}

// The background jobs which can be deployed by the application.
#[derive(Debug, Deserialize, Serialize, Display)]
pub enum ApplicationJob {
    UpdatePerson(String),
    SyncIntegrationsData,
    UpdateExerciseLibrary,
    PerformExport(String),
    PerformBackgroundTasks,
    RecalculateCalendarEvents,
    ReviseUserWorkouts(String),
    UpdateMetadataGroup(String),
    UpdateMetadata(String, bool),
    HandleOnSeenComplete(String),
    HandleAfterMediaSeenTasks(seen::Model),
    UpdateGithubExerciseJob(GithubExercise),
    HandleEntityAddedToCollectionEvent(Uuid),
    RecalculateUserActivitiesAndSummary(String, bool),
    AssociateGroupWithMetadata(MediaLot, MediaSource, String),
    ImportFromExternalSource(String, Box<DeployImportJobInput>),
}

// Cron Jobs
pub struct ScheduledJob(pub DateTime<Tz>);

impl From<DateTime<Tz>> for ScheduledJob {
    fn from(value: DateTime<Tz>) -> Self {
        Self(value)
    }
}
