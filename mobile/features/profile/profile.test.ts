import { describe, it, expect, vi } from "vitest";

import {
  bookingUrl,
  directionsUrl,
  profileKind,
  seating,
  servicesOf,
  specialties,
  staffFor,
  telUrl,
  whatsappUrl,
} from "./profile";
import type { PublicResource, PublicStaffMember } from "@/types/api";

// Hoisted by vitest above the imports; written here to keep imports first.
vi.mock("@/lib/config", () => ({ config: { apiUrl: "https://maw3ed.net" } }));

const member = (over: Partial<PublicStaffMember> = {}): PublicStaffMember => ({
  id: "m1",
  nameAr: "أحمد",
  nameEn: null,
  role: null,
  photo: null,
  specialties: [],
  serviceIds: [],
  hours: [],
  nextSlot: null,
  ...over,
});

const cat = (slug: string, parentSlug: string | null = null) => ({ slug, nameAr: "", nameEn: "", parentSlug });

describe("profileKind", () => {
  it("reads a restaurant from its type or its category", () => {
    expect(profileKind({ businessType: "RESTAURANT", category: cat("other"), staff: [] })).toBe("dining");
    expect(profileKind({ businessType: "GENERAL", category: cat("restaurants"), staff: [] })).toBe("dining");
  });

  it("reads medical categories, and their subcategories, as a clinic", () => {
    expect(profileKind({ businessType: "GENERAL", category: cat("dentists"), staff: [] })).toBe("clinic");
    expect(profileKind({ businessType: "GENERAL", category: cat("orthodontics", "clinics"), staff: [] })).toBe("clinic");
  });

  it("gives a salon, a barbershop, or anywhere with people, a team", () => {
    expect(profileKind({ businessType: "GENERAL", category: cat("salons"), staff: [] })).toBe("team");
    expect(profileKind({ businessType: "BARBERSHOP", category: cat("other"), staff: [] })).toBe("team");
    expect(profileKind({ businessType: "GENERAL", category: cat("gyms"), staff: [member()] })).toBe("team");
  });

  it("falls back to general", () => {
    expect(profileKind({ businessType: "GENERAL", category: cat("legal"), staff: [] })).toBe("general");
  });
});

describe("people and services", () => {
  it("lists each specialty once, ignoring case", () => {
    const staff = [member({ specialties: ["Braces", "Implants"] }), member({ id: "m2", specialties: ["braces", "Whitening"] })];
    expect(specialties(staff)).toEqual(["Braces", "Implants", "Whitening"]);
  });

  it("treats somebody linked to no services as doing all of them, as booking does", () => {
    const all = member({ id: "all" });
    const cuts = member({ id: "cuts", serviceIds: ["cut"] });
    expect(staffFor([all, cuts], "colour").map((m) => m.id)).toEqual(["all"]);
    expect(staffFor([all, cuts], "cut").map((m) => m.id)).toEqual(["all", "cuts"]);
    const services = [{ id: "cut" }, { id: "colour" }];
    expect(servicesOf(cuts, services)).toEqual([{ id: "cut" }]);
    expect(servicesOf(all, services)).toEqual(services);
  });
});

describe("seating", () => {
  const table = (over: Partial<PublicResource>): PublicResource => ({
    id: "t",
    kind: "TABLE",
    name: "T",
    capacity: null,
    area: null,
    branchId: null,
    ...over,
  });

  it("is null without tables, so nothing about seating is made up", () => {
    expect(seating([])).toBeNull();
    expect(seating([table({ kind: "ROOM" })])).toBeNull();
  });

  it("summarises seat range and areas from the tables there are", () => {
    const s = seating([
      table({ id: "a", capacity: 2, area: "الحديقة" }),
      table({ id: "b", capacity: 8, area: " الحديقة " }),
      table({ id: "c", capacity: null, area: "Indoor" }),
    ]);
    expect(s).toEqual({ seats: { min: 2, max: 8 }, areas: ["الحديقة", "Indoor"], count: 3 });
  });

  it("leaves seats out when no table counts them", () => {
    expect(seating([table({})])?.seats).toBeNull();
  });
});

describe("links", () => {
  it("opens booking on the chosen service and person, credited to the marketplace", () => {
    expect(bookingUrl("qa-salon")).toBe("https://maw3ed.net/company/qa-salon?src=maw3ed#booking");
    expect(bookingUrl("qa-salon", { serviceId: "s1", staffId: "m1" })).toBe(
      "https://maw3ed.net/company/qa-salon?src=maw3ed&service=s1&staff=m1#booking",
    );
    // A person without a service would be ignored by the widget; not sent.
    expect(bookingUrl("qa-salon", { staffId: "m1" })).toBe("https://maw3ed.net/company/qa-salon?src=maw3ed#booking");
  });

  it("searches maps for the written address, and gives up without one", () => {
    expect(directionsUrl(["12 شارع 9", null, "Cairo"])).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("12 شارع 9, Cairo")}`,
    );
    expect(directionsUrl([null, " "])).toBeNull();
  });

  it("makes WhatsApp and phone links from the numbers owners type", () => {
    expect(whatsappUrl("01001234567")).toBe("https://wa.me/201001234567");
    expect(whatsappUrl("+971 50 123 4567")).toBe("https://wa.me/971501234567");
    expect(whatsappUrl("0020100123456")).toBe("https://wa.me/20100123456");
    expect(whatsappUrl("12")).toBeNull();
    expect(telUrl("02 2345 6789")).toBe("tel:0223456789");
    expect(telUrl("-")).toBeNull();
  });
});
