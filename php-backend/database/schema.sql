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

-- TECHNICAL_SERVICE_V1_BEGIN

-- Роль пользователя именно в системе технической службы.
-- Старое поле users.role сохраняется для совместимости с текущей авторизацией.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS service_role VARCHAR(30) NOT NULL DEFAULT 'Technician';

UPDATE users
SET service_role = 'Administrator'
WHERE role = 'Admin'
  AND service_role = 'Technician';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_service_role_check'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_service_role_check
            CHECK (
                service_role IN (
                    'Technician',
                    'CoTechnician',
                    'Dispatcher',
                    'Manager',
                    'Administrator'
                )
            );
    END IF;
END
$$;

-- Справочник причин паузы
CREATE TABLE IF NOT EXISTS pause_reasons
(
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO pause_reasons (code, title, sort_order)
VALUES
    ('lunch', 'Обед', 10),
    ('road', 'Дорога', 20),
    ('materials', 'Ожидание материалов', 30),
    ('access', 'Ожидание доступа на объект', 40),
    ('client', 'Ожидание клиента', 50),
    ('other', 'Иное', 100)
ON CONFLICT (code)
DO UPDATE SET
    title = EXCLUDED.title,
    sort_order = EXCLUDED.sort_order;

-- Расширение существующих смен
ALTER TABLE work_shifts
    ADD COLUMN IF NOT EXISTS start_latitude NUMERIC(9, 6),
    ADD COLUMN IF NOT EXISTS start_longitude NUMERIC(9, 6),
    ADD COLUMN IF NOT EXISTS start_accuracy NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS start_device TEXT,
    ADD COLUMN IF NOT EXISTS start_photo_url VARCHAR(1000),
    ADD COLUMN IF NOT EXISTS finish_latitude NUMERIC(9, 6),
    ADD COLUMN IF NOT EXISTS finish_longitude NUMERIC(9, 6),
    ADD COLUMN IF NOT EXISTS finish_accuracy NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS current_pause_reason_id BIGINT
        REFERENCES pause_reasons(id) ON DELETE SET NULL;

-- Каждый период паузы хранится отдельно
CREATE TABLE IF NOT EXISTS shift_pauses
(
    id BIGSERIAL PRIMARY KEY,
    shift_id BIGINT NOT NULL REFERENCES work_shifts(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason_id BIGINT NOT NULL REFERENCES pause_reasons(id) ON DELETE RESTRICT,
    comment TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    duration_seconds BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS shift_pauses_one_open_per_shift_idx
    ON shift_pauses(shift_id)
    WHERE finished_at IS NULL;

CREATE INDEX IF NOT EXISTS shift_pauses_user_started_idx
    ON shift_pauses(user_id, started_at DESC);

-- Объекты обслуживания
CREATE TABLE IF NOT EXISTS service_objects
(
    id BIGSERIAL PRIMARY KEY,
    external_code VARCHAR(150) UNIQUE,
    bitrix_entity_id VARCHAR(150) UNIQUE,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    control_panel_numbers TEXT,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS service_objects_address_idx
    ON service_objects USING GIN (to_tsvector('simple', address));

CREATE TABLE IF NOT EXISTS object_contacts
(
    id BIGSERIAL PRIMARY KEY,
    object_id BIGINT NOT NULL REFERENCES service_objects(id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    position VARCHAR(150),
    phone VARCHAR(100),
    email VARCHAR(255),
    comment TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS object_contacts_object_idx
    ON object_contacts(object_id);

CREATE TABLE IF NOT EXISTS object_files
(
    id BIGSERIAL PRIMARY KEY,
    object_id BIGINT NOT NULL REFERENCES service_objects(id) ON DELETE CASCADE,
    file_type VARCHAR(30) NOT NULL DEFAULT 'Other',
    file_name VARCHAR(500) NOT NULL,
    file_url VARCHAR(1000) NOT NULL,
    mime_type VARCHAR(150),
    uploaded_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT object_files_type_check CHECK (
        file_type IN ('Scheme', 'Drawing', 'Document', 'Contract', 'Other')
    )
);

CREATE TABLE IF NOT EXISTS service_contracts
(
    id BIGSERIAL PRIMARY KEY,
    object_id BIGINT NOT NULL REFERENCES service_objects(id) ON DELETE CASCADE,
    contract_number VARCHAR(150) NOT NULL,
    contract_date DATE,
    file_url VARCHAR(1000),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Типы работ
CREATE TABLE IF NOT EXISTS work_types
(
    id BIGSERIAL PRIMARY KEY,
    external_code VARCHAR(150) UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    default_weight NUMERIC(5, 2),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT work_types_default_weight_check CHECK (
        default_weight IS NULL
        OR default_weight > 0 AND default_weight <= 100
    )
);

-- Причины брака
CREATE TABLE IF NOT EXISTS defect_reasons
(
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO defect_reasons (code, title, sort_order)
VALUES
    ('incorrect_work', 'Работы выполнены некорректно', 10),
    ('incomplete_work', 'Работы выполнены не полностью', 20),
    ('missing_act', 'Отсутствует или некорректен акт', 30),
    ('poor_photo', 'Фотоотчёт не соответствует требованиям', 40),
    ('other', 'Иная причина', 100)
ON CONFLICT (code)
DO UPDATE SET
    title = EXCLUDED.title,
    sort_order = EXCLUDED.sort_order;

-- Заявки технической службы
CREATE TABLE IF NOT EXISTS service_requests
(
    id BIGSERIAL PRIMARY KEY,
    request_number VARCHAR(100) NOT NULL UNIQUE,
    bitrix_entity_id VARCHAR(150) UNIQUE,
    external_code VARCHAR(150),

    object_id BIGINT NOT NULL
        REFERENCES service_objects(id) ON DELETE RESTRICT,

    created_by_user_id BIGINT
        REFERENCES users(id) ON DELETE SET NULL,

    primary_technician_id BIGINT
        REFERENCES users(id) ON DELETE SET NULL,

    source_request_id BIGINT
        REFERENCES service_requests(id) ON DELETE SET NULL,

    problem_type VARCHAR(255),
    title VARCHAR(500) NOT NULL,
    description TEXT,

    priority VARCHAR(30) NOT NULL DEFAULT 'Normal',
    sla_deadline TIMESTAMPTZ,

    status VARCHAR(30) NOT NULL DEFAULT 'New',
    progress_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,

    is_repeat BOOLEAN NOT NULL DEFAULT FALSE,
    is_defect BOOLEAN NOT NULL DEFAULT FALSE,

    defect_reason_id BIGINT
        REFERENCES defect_reasons(id) ON DELETE SET NULL,

    defect_comment TEXT,
    defect_by_user_id BIGINT
        REFERENCES users(id) ON DELETE SET NULL,
    defect_at TIMESTAMPTZ,

    arrival_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,

    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at TIMESTAMPTZ,

    source_system VARCHAR(30) NOT NULL DEFAULT 'Portal',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT service_requests_priority_check CHECK (
        priority IN ('Low', 'Normal', 'High', 'Critical')
    ),

    CONSTRAINT service_requests_status_check CHECK (
        status IN (
            'New',
            'Accepted',
            'OnSite',
            'InProgress',
            'Waiting',
            'PartiallyCompleted',
            'Completed',
            'Closed',
            'Defect',
            'Repeat'
        )
    ),

    CONSTRAINT service_requests_progress_check CHECK (
        progress_percent >= 0 AND progress_percent <= 100
    ),

    CONSTRAINT service_requests_source_check CHECK (
        source_system IN ('Portal', 'Bitrix24', 'OneC', 'Excel', 'CSV')
    )
);

CREATE INDEX IF NOT EXISTS service_requests_object_idx
    ON service_requests(object_id, created_at DESC);

CREATE INDEX IF NOT EXISTS service_requests_technician_idx
    ON service_requests(primary_technician_id, status);

CREATE INDEX IF NOT EXISTS service_requests_status_idx
    ON service_requests(status, sla_deadline);

CREATE INDEX IF NOT EXISTS service_requests_archive_idx
    ON service_requests(is_archived, archived_at);

-- Основной исполнитель и соисполнители
CREATE TABLE IF NOT EXISTS request_assignees
(
    id BIGSERIAL PRIMARY KEY,
    request_id BIGINT NOT NULL
        REFERENCES service_requests(id) ON DELETE CASCADE,

    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    assignment_role VARCHAR(30) NOT NULL DEFAULT 'Assistant',
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    removed_at TIMESTAMPTZ,

    CONSTRAINT request_assignees_role_check CHECK (
        assignment_role IN ('Primary', 'Assistant')
    ),

    CONSTRAINT request_assignees_unique UNIQUE (request_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS request_assignees_one_primary_idx
    ON request_assignees(request_id)
    WHERE assignment_role = 'Primary' AND removed_at IS NULL;

CREATE INDEX IF NOT EXISTS request_assignees_user_idx
    ON request_assignees(user_id, removed_at);

-- Пункты чек-листа заявки
CREATE TABLE IF NOT EXISTS request_work_items
(
    id BIGSERIAL PRIMARY KEY,
    request_id BIGINT NOT NULL
        REFERENCES service_requests(id) ON DELETE CASCADE,

    work_type_id BIGINT
        REFERENCES work_types(id) ON DELETE SET NULL,

    title VARCHAR(255) NOT NULL,
    weight NUMERIC(5, 2) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,

    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_by_user_id BIGINT
        REFERENCES users(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT request_work_items_weight_check CHECK (
        weight > 0 AND weight <= 100
    )
);

CREATE INDEX IF NOT EXISTS request_work_items_request_idx
    ON request_work_items(request_id, sort_order, id);

-- История статусов
CREATE TABLE IF NOT EXISTS request_status_history
(
    id BIGSERIAL PRIMARY KEY,
    request_id BIGINT NOT NULL
        REFERENCES service_requests(id) ON DELETE CASCADE,

    changed_by_user_id BIGINT
        REFERENCES users(id) ON DELETE SET NULL,

    old_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,

    comment TEXT,
    source VARCHAR(30) NOT NULL DEFAULT 'Portal',

    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    accuracy NUMERIC(10, 2),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT request_status_history_source_check CHECK (
        source IN ('Portal', 'Mobile', 'Bitrix24', 'Import', 'System')
    )
);

CREATE INDEX IF NOT EXISTS request_status_history_request_idx
    ON request_status_history(request_id, created_at DESC);

-- Комментарии
CREATE TABLE IF NOT EXISTS request_comments
(
    id BIGSERIAL PRIMARY KEY,
    request_id BIGINT NOT NULL
        REFERENCES service_requests(id) ON DELETE CASCADE,

    author_user_id BIGINT
        REFERENCES users(id) ON DELETE SET NULL,

    comment_type VARCHAR(30) NOT NULL DEFAULT 'Service',
    message TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT request_comments_type_check CHECK (
        comment_type IN ('Service', 'Client', 'System')
    )
);

CREATE INDEX IF NOT EXISTS request_comments_request_idx
    ON request_comments(request_id, created_at);

-- Фото, видео, схемы и акты
CREATE TABLE IF NOT EXISTS request_attachments
(
    id BIGSERIAL PRIMARY KEY,
    request_id BIGINT NOT NULL
        REFERENCES service_requests(id) ON DELETE CASCADE,

    uploaded_by_user_id BIGINT
        REFERENCES users(id) ON DELETE SET NULL,

    attachment_type VARCHAR(30) NOT NULL DEFAULT 'Other',
    file_name VARCHAR(500) NOT NULL,
    file_url VARCHAR(1000) NOT NULL,
    mime_type VARCHAR(150),
    file_size BIGINT,

    quality_score NUMERIC(5, 2),
    is_document_scan BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT request_attachments_type_check CHECK (
        attachment_type IN (
            'BeforePhoto',
            'AfterPhoto',
            'ActPhoto',
            'Video',
            'Scheme',
            'Contract',
            'Other'
        )
    )
);

CREATE INDEX IF NOT EXISTS request_attachments_request_idx
    ON request_attachments(request_id, created_at);

-- Штрих-коды прибытия и актов
CREATE TABLE IF NOT EXISTS request_barcodes
(
    id BIGSERIAL PRIMARY KEY,
    request_id BIGINT NOT NULL
        REFERENCES service_requests(id) ON DELETE CASCADE,

    barcode_type VARCHAR(30) NOT NULL,
    barcode_format VARCHAR(30),
    barcode_value VARCHAR(500) NOT NULL,

    scanned_by_user_id BIGINT
        REFERENCES users(id) ON DELETE SET NULL,

    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    accuracy NUMERIC(10, 2),

    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT request_barcodes_type_check CHECK (
        barcode_type IN ('Arrival', 'Act')
    ),

    CONSTRAINT request_barcodes_unique UNIQUE (
        request_id,
        barcode_type,
        barcode_value
    )
);

CREATE INDEX IF NOT EXISTS request_barcodes_request_idx
    ON request_barcodes(request_id, scanned_at DESC);

-- Связь сущностей портала с Битрикс24
CREATE TABLE IF NOT EXISTS bitrix_entity_links
(
    id BIGSERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    portal_entity_id BIGINT NOT NULL,
    bitrix_entity_id VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT bitrix_entity_links_unique
        UNIQUE (entity_type, portal_entity_id),

    CONSTRAINT bitrix_entity_links_bitrix_unique
        UNIQUE (entity_type, bitrix_entity_id)
);

CREATE TABLE IF NOT EXISTS bitrix_sync_log
(
    id BIGSERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    portal_entity_id BIGINT,
    bitrix_entity_id VARCHAR(150),
    direction VARCHAR(30) NOT NULL,
    payload_hash VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'Pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_at TIMESTAMPTZ,

    CONSTRAINT bitrix_sync_log_direction_check CHECK (
        direction IN ('ToBitrix', 'FromBitrix')
    ),

    CONSTRAINT bitrix_sync_log_status_check CHECK (
        status IN ('Pending', 'Processing', 'Success', 'Error')
    )
);

CREATE INDEX IF NOT EXISTS bitrix_sync_log_pending_idx
    ON bitrix_sync_log(status, created_at);

-- Импорт 1С / Excel / CSV
CREATE TABLE IF NOT EXISTS import_jobs
(
    id BIGSERIAL PRIMARY KEY,
    source_type VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Pending',
    file_name VARCHAR(500),
    file_hash VARCHAR(128),
    total_rows INTEGER NOT NULL DEFAULT 0,
    processed_rows INTEGER NOT NULL DEFAULT 0,
    success_rows INTEGER NOT NULL DEFAULT 0,
    error_rows INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT import_jobs_source_check CHECK (
        source_type IN ('FTP', 'OneC', 'Excel', 'CSV')
    ),

    CONSTRAINT import_jobs_status_check CHECK (
        status IN ('Pending', 'Processing', 'Completed', 'CompletedWithErrors', 'Error')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS import_jobs_file_hash_idx
    ON import_jobs(file_hash)
    WHERE file_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS import_rows
(
    id BIGSERIAL PRIMARY KEY,
    import_job_id BIGINT NOT NULL
        REFERENCES import_jobs(id) ON DELETE CASCADE,

    row_number INTEGER NOT NULL,
    external_code VARCHAR(150),
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'Pending',
    service_request_id BIGINT
        REFERENCES service_requests(id) ON DELETE SET NULL,
    error_message TEXT,
    processed_at TIMESTAMPTZ,

    CONSTRAINT import_rows_status_check CHECK (
        status IN ('Pending', 'Success', 'Skipped', 'Error')
    ),

    CONSTRAINT import_rows_unique UNIQUE (
        import_job_id,
        row_number
    )
);

CREATE INDEX IF NOT EXISTS import_rows_job_status_idx
    ON import_rows(import_job_id, status);

-- TECHNICAL_SERVICE_V1_END

-- SERVICE_REQUEST_API_V1_BEGIN

ALTER TABLE service_requests
    ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS work_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS waiting_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS expected_arrival_barcode VARCHAR(500),
    ADD COLUMN IF NOT EXISTS expected_act_barcode VARCHAR(500);

CREATE TABLE IF NOT EXISTS request_wait_reasons
(
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO request_wait_reasons
    (code, title, sort_order)
VALUES
    ('parts', 'Ожидание запчастей или материалов', 10),
    ('access', 'Ожидание доступа на объект', 20),
    ('client', 'Ожидание клиента', 30),
    ('approval', 'Ожидание согласования', 40),
    ('other', 'Иное', 100)
ON CONFLICT (code)
DO UPDATE SET
    title = EXCLUDED.title,
    sort_order = EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS request_wait_periods
(
    id BIGSERIAL PRIMARY KEY,

    request_id BIGINT NOT NULL
        REFERENCES service_requests(id) ON DELETE CASCADE,

    reason_id BIGINT
        REFERENCES request_wait_reasons(id) ON DELETE SET NULL,

    started_by_user_id BIGINT
        REFERENCES users(id) ON DELETE SET NULL,

    finished_by_user_id BIGINT
        REFERENCES users(id) ON DELETE SET NULL,

    comment TEXT,

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,

    duration_seconds BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS request_wait_periods_one_open_idx
    ON request_wait_periods(request_id)
    WHERE finished_at IS NULL;

CREATE INDEX IF NOT EXISTS request_wait_periods_request_idx
    ON request_wait_periods(request_id, started_at DESC);

-- SERVICE_REQUEST_API_V1_END

-- SERVICE_REQUEST_CONTENT_V1_BEGIN

ALTER TABLE request_attachments
    ADD COLUMN IF NOT EXISTS original_name VARCHAR(500),
    ADD COLUMN IF NOT EXISTS storage_path VARCHAR(1500),
    ADD COLUMN IF NOT EXISTS sha256 VARCHAR(64),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS request_attachments_active_idx
    ON request_attachments(request_id, attachment_type, created_at)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS request_acts
(
    id BIGSERIAL PRIMARY KEY,

    request_id BIGINT NOT NULL UNIQUE
        REFERENCES service_requests(id) ON DELETE CASCADE,

    barcode_id BIGINT
        REFERENCES request_barcodes(id) ON DELETE SET NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'Draft',

    created_by_user_id BIGINT
        REFERENCES users(id) ON DELETE SET NULL,

    validated_by_user_id BIGINT
        REFERENCES users(id) ON DELETE SET NULL,

    validation_comment TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    validated_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT request_acts_status_check CHECK (
        status IN ('Draft', 'Validated', 'Rejected')
    )
);

CREATE TABLE IF NOT EXISTS request_act_pages
(
    id BIGSERIAL PRIMARY KEY,

    act_id BIGINT NOT NULL
        REFERENCES request_acts(id) ON DELETE CASCADE,

    attachment_id BIGINT NOT NULL UNIQUE
        REFERENCES request_attachments(id) ON DELETE CASCADE,

    page_number INTEGER NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT request_act_pages_number_check CHECK (
        page_number > 0
    ),

    CONSTRAINT request_act_pages_unique
        UNIQUE (act_id, page_number)
);

CREATE INDEX IF NOT EXISTS request_act_pages_act_idx
    ON request_act_pages(act_id, page_number);

-- SERVICE_REQUEST_CONTENT_V1_END

-- TECHNICAL_SHIFT_START_LOCATION_V1
ALTER TABLE work_shifts
    ADD COLUMN IF NOT EXISTS start_latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS start_longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS start_accuracy DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS start_device TEXT,
    ADD COLUMN IF NOT EXISTS start_photo_url TEXT;

-- SERVICE_REQUEST_LIST_POSTGRES_V1
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS service_role VARCHAR(30);

ALTER TABLE service_objects
    ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
    ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);

ALTER TABLE service_requests
    ADD COLUMN IF NOT EXISTS is_repeat BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_defect BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS progress_percent NUMERIC(5, 2) NOT NULL DEFAULT 0;

-- PORTAL_SUPPORT_MESSAGES_V1
CREATE TABLE IF NOT EXISTS support_messages
(
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    message TEXT NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'New',

    admin_reply TEXT,

    answered_by_user_id BIGINT
        REFERENCES users(id) ON DELETE SET NULL,

    answered_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT support_messages_status_check CHECK (
        status IN (
            'New',
            'InProgress',
            'Resolved',
            'Closed'
        )
    )
);

CREATE INDEX IF NOT EXISTS support_messages_user_idx
    ON support_messages(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS support_messages_status_idx
    ON support_messages(status, created_at DESC);

-- PORTAL_SUPPORT_THREADS_V1
CREATE TABLE IF NOT EXISTS support_threads
(
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    subject VARCHAR(255) NOT NULL,

    status VARCHAR(30)
        NOT NULL
        DEFAULT 'New',

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS support_thread_messages
(
    id BIGSERIAL PRIMARY KEY,

    thread_id BIGINT NOT NULL
        REFERENCES support_threads(id)
        ON DELETE CASCADE,

    sender_user_id BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    sender_type VARCHAR(20) NOT NULL,

    message TEXT NOT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()
);

-- PORTAL_SUPPORT_UNREAD_V1
ALTER TABLE support_threads
    ADD COLUMN IF NOT EXISTS
        user_last_read_message_id BIGINT
        NOT NULL
        DEFAULT 0;

CREATE INDEX IF NOT EXISTS
    support_thread_messages_unread_idx
ON support_thread_messages
(
    thread_id,
    sender_type,
    id
);
