import ServiceRequestListScreen from "@/components/ServiceRequestListScreen";

export default function ArchiveScreen() {
  return (
    <ServiceRequestListScreen
      initialMode="archive"
      showBack
      title="Архив заявок"
    />
  );
}
