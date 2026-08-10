export type ServiceRequestStatus =
  | "New"
  | "Accepted"
  | "OnSite"
  | "InProgress"
  | "Waiting"
  | "PartiallyCompleted"
  | "Completed"
  | "Closed"
  | "Defect"
  | "Repeat";

export type ServiceRequestPriority =
  | "Low"
  | "Normal"
  | "High"
  | "Critical";

export type ServiceRequestSummary = {
  id: number;
  requestNumber: string;
  title: string;
  description: string | null;
  problemType: string | null;
  priority: ServiceRequestPriority;
  status: ServiceRequestStatus;
  progressPercent: number;
  isRepeat: boolean;
  isDefect: boolean;
  isArchived: boolean;
  slaDeadline: string | null;

  object: {
    id: number;
    name: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
  };

  assignmentRole:
    | "Primary"
    | "Assistant"
    | null;

  createdAt: string;
  updatedAt: string;
};

export type ServiceRequestDetail = {
  id: number;
  requestNumber: string;
  title: string;
  description: string | null;
  problemType: string | null;
  priority: ServiceRequestPriority;
  status: ServiceRequestStatus;
  progressPercent: number;
  slaDeadline: string | null;

  isRepeat: boolean;
  isDefect: boolean;
  isArchived: boolean;

  sourceRequestId: number | null;

  expectedArrivalBarcodeConfigured: boolean;
  expectedActBarcodeConfigured: boolean;

  object: {
    id: number;
    name: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    controlPanelNumbers: string | null;
    description: string | null;

    contacts: Array<{
      id: number;
      fullName: string | null;
      position: string | null;
      phone: string | null;
      email: string | null;
      comment: string | null;
      isPrimary: boolean;
    }>;
  };

  assignees: Array<{
    userId: number;
    role: "Primary" | "Assistant";
    firstName: string;
    lastName: string;
    middleName: string | null;
    avatarUrl: string | null;
    position: string | null;
    assignedAt: string;
    acceptedAt: string | null;
  }>;

  workItems: Array<{
    id: number;
    workTypeId: number | null;
    title: string;
    weight: number;
    isCompleted: boolean;
    completedAt: string | null;

    completedBy: {
      id: number;
      firstName: string;
      lastName: string;
    } | null;
  }>;

  statusHistory: Array<{
    id: number;
    oldStatus: ServiceRequestStatus | null;
    newStatus: ServiceRequestStatus;
    comment: string | null;
    source: string;
    latitude: number | null;
    longitude: number | null;
    createdAt: string;

    user: {
      id: number;
      firstName: string;
      lastName: string;
    } | null;
  }>;

  acceptedAt: string | null;
  arrivalAt: string | null;
  workStartedAt: string | null;
  completedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const serviceStatusLabels:
  Record<ServiceRequestStatus, string> = {
    New: "Новая",
    Accepted: "Принята",
    OnSite: "На объекте",
    InProgress: "В работе",
    Waiting: "Ожидание",
    PartiallyCompleted: "Частично выполнена",
    Completed: "Выполнена",
    Closed: "Закрыта",
    Defect: "Брак",
    Repeat: "Повторная",
  };

export const servicePriorityLabels:
  Record<ServiceRequestPriority, string> = {
    Low: "Низкий",
    Normal: "Обычный",
    High: "Высокий",
    Critical: "Критический",
  };

export function clampProgress(
  value: number,
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, value),
  );
}
