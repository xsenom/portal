CREATE TABLE IF NOT EXISTS users
(
    id BIGSERIAL PRIMARY KEY,
    login VARCHAR(100) NOT NULL,
    normalized_login VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    normalized_email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'User',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    employment_date DATE,
    position VARCHAR(150),
    category VARCHAR(150),
    avatar_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_role_check CHECK (role IN ('User', 'Admin'))
);

CREATE TABLE IF NOT EXISTS user_contacts
(
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    value VARCHAR(255) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS monthly_indicators
(
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    hours_worked NUMERIC(12, 2),
    hours_norm NUMERIC(12, 2),
    fines_count INTEGER,
    fines_limit INTEGER,
    fines_amount NUMERIC(12, 2),
    base_hourly_rate NUMERIC(12, 2),
    tariff_rate NUMERIC(12, 2),
    tariff_rate_with_coefficient NUMERIC(12, 2),
    total_hourly_rate NUMERIC(12, 2),
    multifunctional BOOLEAN,
    accident_free BOOLEAN,
    has_fines BOOLEAN,
    driver_downtime BOOLEAN,
    responsibility VARCHAR(100),
    late BOOLEAN,
    initiative BOOLEAN,
    execution BOOLEAN,
    completed_count INTEGER,
    total_count INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT monthly_period_unique UNIQUE (user_id, year, month),
    CONSTRAINT monthly_month_check CHECK (month BETWEEN 1 AND 12)
);

CREATE TABLE IF NOT EXISTS tasks
(
    id BIGSERIAL PRIMARY KEY,
    assigned_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(150),
    status VARCHAR(30) NOT NULL DEFAULT 'Assigned',
    planned_hours NUMERIC(12, 2),
    actual_hours NUMERIC(12, 2),
    reward_amount NUMERIC(12, 2),
    initiative_points SMALLINT NOT NULL DEFAULT 0,
    execution_points SMALLINT NOT NULL DEFAULT 0,
    responsibility_points SMALLINT NOT NULL DEFAULT 0,
    due_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    submission_comment TEXT,
    approval_comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tasks_assigned_user_idx ON tasks(assigned_user_id);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);
CREATE INDEX IF NOT EXISTS tasks_due_at_idx ON tasks(due_at);

CREATE TABLE IF NOT EXISTS user_pay_settings
(
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    monthly_hours_norm NUMERIC(12, 2),
    base_hourly_rate NUMERIC(12, 2),
    tariff_rate NUMERIC(12, 2),
    coefficient NUMERIC(12, 4) NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_events
(
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(30) NOT NULL,
    title VARCHAR(255),
    description TEXT,
    amount NUMERIC(12, 2),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS work_events_user_period_idx ON work_events(user_id, occurred_at);

CREATE TABLE IF NOT EXISTS work_shifts
(
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'Working',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    work_seconds BIGINT NOT NULL DEFAULT 0,
    pause_seconds BIGINT NOT NULL DEFAULT 0,
    current_segment_started_at TIMESTAMPTZ,
    current_pause_started_at TIMESTAMPTZ,
    pauses_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS work_shifts_one_active_per_user_idx
    ON work_shifts(user_id)
    WHERE status IN ('Working', 'Paused');

CREATE INDEX IF NOT EXISTS work_shifts_user_started_idx ON work_shifts(user_id, started_at);
