import { describe, it, expect, vi, beforeEach } from "vitest";
import { TrackingService } from "../../src/services/tracking-service.js";

const mockSupabase = {
  from: vi.fn(),
};

const mockFacebookCapi = {
  sendPurchaseEvent: vi.fn().mockResolvedValue(true),
  sendLeadEvent: vi.fn().mockResolvedValue(true),
};

const mockUtmify = {
  sendConversion: vi.fn().mockResolvedValue(true),
};

function mockChain(returnData: unknown = null, returnError: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: returnData, error: returnError }),
  };
  mockSupabase.from.mockReturnValue(chain);
  return chain;
}

describe("TrackingService", () => {
  let service: TrackingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TrackingService(
      mockSupabase as any,
      mockFacebookCapi as any,
      mockUtmify as any,
    );
  });

  it("should track a purchase event and dispatch to Facebook + Utmify", async () => {
    const chain = mockChain({ id: "evt-1" });

    await service.trackPurchase({
      tenantId: "t-1",
      leadId: "lead-1",
      botId: "bot-1",
      transactionId: "tx-1",
      amount: 97.0,
      currency: "BRL",
      fbclid: "fbclid_abc",
      tid: "tid_xyz",
      utmSource: "facebook",
      utmMedium: "cpc",
      utmCampaign: "launch",
    });

    expect(mockSupabase.from).toHaveBeenCalledWith("tracking_events");
    expect(mockFacebookCapi.sendPurchaseEvent).toHaveBeenCalled();
    expect(mockUtmify.sendConversion).toHaveBeenCalled();
  });

  it("should track a lead event (bot_start)", async () => {
    mockChain({ id: "evt-2" });

    await service.trackLead({
      tenantId: "t-1",
      leadId: "lead-1",
      botId: "bot-1",
      fbclid: "fbclid_abc",
      tid: "tid_xyz",
    });

    expect(mockSupabase.from).toHaveBeenCalledWith("tracking_events");
    expect(mockFacebookCapi.sendLeadEvent).toHaveBeenCalled();
  });
});
