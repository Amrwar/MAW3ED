import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Typography";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Day and week calendar, against the availability engine.
 *
 * A placeholder. This phase builds the architecture, not the screens —
 * so rather than mock data that would have to be torn out, it says
 * plainly that there is nothing here yet.
 */
export default function BusinessCalendar() {
  return (
    <Screen>
      <Text variant="title">التقويم</Text>
      <EmptyState title="قيد الإنشاء" body="الشاشة دي هتتبني في المرحلة الجاية." />
    </Screen>
  );
}
