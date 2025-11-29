ALTER TABLE "tasks" DROP CONSTRAINT "tasks_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "tasks_user_id_idx";--> statement-breakpoint
CREATE INDEX "tasks_user_id_idx" ON "tasks" USING btree (((data->>'userId')));--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "user_id";