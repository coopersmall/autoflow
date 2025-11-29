ALTER TABLE "integrations" ALTER COLUMN "data" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "integrations" ALTER COLUMN "data" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "secrets" ALTER COLUMN "data" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "secrets" ALTER COLUMN "data" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "data" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "data" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "data" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "data" SET DEFAULT '{}'::jsonb;