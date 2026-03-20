import { redirect } from "next/navigation";

export default function InsightsPage() {
  redirect("/radar?stage=early");
}
