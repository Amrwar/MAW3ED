import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Typography";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Customer home: search entry, categories, nearby.
 *
 * A placeholder. This phase builds the architecture, not the screens —
 * so rather than mock data that would have to be torn out, it says
 * plainly that there is nothing here yet.
 */
export default function CustomerHome() {
  return (
    <Screen>
      <Text variant="title">الرئيسية</Text>
      <EmptyState title="قيد الإنشاء" body="الشاشة دي هتتبني في المرحلة الجاية." />
    </Screen>
  );
}
