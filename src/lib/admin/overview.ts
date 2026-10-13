import type { AdminRole } from "@prisma/client";
import { db } from "@/lib/db";
import { can } from "./permissions";

/**
 * The figures on the admin landing page, for the web page and the app.
 *
 * Each is behind the permission that owns it, and a figure the role may
 * not see is null rather than zero — the query is never run, and the
 * caller can tell "none" from "not yours to know".
 */
export interface AdminOverview {
  pendingBusinesses: number | null;
  totalBusinesses: number | null;
  suspendedBusinesses: number | null;
  openReports: number | null;
  reviewsUnderReview: number | null;
  paidBookings: number | null;
}

export async function adminOverview(role: AdminRole): Promise<AdminOverview> {
  const seeBusinesses = can(role, "businesses.read");
  const seeReviews = can(role, "reviews.read");
  const seeMoney = can(role, "payments.read");

  const [pendingBusinesses, totalBusinesses, suspendedBusinesses, openReports, reviewsUnderReview, paidBookings] =
    await Promise.all([
      seeBusinesses ? db.business.count({ where: { status: "PENDING" } }) : null,
      seeBusinesses ? db.business.count() : null,
      seeBusinesses ? db.business.count({ where: { status: "SUSPENDED" } }) : null,
      seeReviews ? db.reviewReport.count({ where: { status: "OPEN" } }) : null,
      seeReviews ? db.review.count({ where: { status: "UNDER_REVIEW" } }) : null,
      seeMoney ? db.booking.count({ where: { paymobTransactionId: { not: null } } }) : null,
    ]);

  return { pendingBusinesses, totalBusinesses, suspendedBusinesses, openReports, reviewsUnderReview, paidBookings };
}
