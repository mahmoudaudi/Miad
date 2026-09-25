import { NotFoundException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  it('records views only for published invitations', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = {
      invitation: { findFirst: jest.fn().mockResolvedValue({ id: 'inv-1' }) },
      invitationView: { create },
    };

    await expect(
      new AnalyticsService(prisma as never).recordPublicView('garden-dinner', {
        sessionIdentifier: 'session-1',
        deviceType: 'mobile',
      })
    ).resolves.toEqual({ recorded: true });
    expect(create).toHaveBeenCalledWith({
      data: { invitationId: 'inv-1', sessionIdentifier: 'session-1', deviceType: 'mobile' },
    });
  });

  it('aggregates owner-scoped views and RSVP counts', async () => {
    const prisma = {
      invitation: {
        findFirst: jest.fn().mockResolvedValue({
          views: [
            { sessionIdentifier: 'one' },
            { sessionIdentifier: 'one' },
            { sessionIdentifier: 'two' },
            { sessionIdentifier: null },
          ],
          guests: [
            { rsvp: { status: 'ATTENDING', attendeesCount: 3 } },
            { rsvp: { status: 'NOT_ATTENDING', attendeesCount: 0 } },
            { rsvp: { status: 'PENDING', attendeesCount: 0 } },
            { rsvp: null },
          ],
        }),
      },
    };

    await expect(new AnalyticsService(prisma as never).findForOwner('owner-1', 'inv-1')).resolves.toEqual({
      views: 4,
      uniqueVisitors: 2,
      rsvps: 3,
      attending: 1,
      notAttending: 1,
      pending: 1,
      attendingGuests: 3,
    });
  });

  it('does not expose analytics for another owner', async () => {
    const service = new AnalyticsService({
      invitation: { findFirst: jest.fn().mockResolvedValue(null) },
    } as never);
    await expect(service.findForOwner('other-owner', 'inv-1')).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
