import ServiceRequestListScreen from "@/components/ServiceRequestListScreen";

export default function MyClosedRequestsScreen() {
  return (
    <ServiceRequestListScreen
      initialMode="completed"
      showBack
      title="Мои закрытые заявки"
    />
  );
}
