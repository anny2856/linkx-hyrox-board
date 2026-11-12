CREATE TABLE races (id TEXT PRIMARY KEY, names TEXT NOT NULL, division TEXT NOT NULL, day TEXT NOT NULL, time TEXT NOT NULL, lane TEXT NOT NULL DEFAULT '', status TEXT NOT NULL CHECK(status IN ('waiting','racing','finished')), sample INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE audit (id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL, action TEXT NOT NULL, race_id TEXT NOT NULL, at TEXT NOT NULL);
