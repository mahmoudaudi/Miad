import { describe, expect, it } from 'vitest';
import { emptyEventForm, eventToForm, validateEventForm } from './event-form';

describe('event form validation', () => {
  it('rejects empty required fields and impossible dates', () => {
    const empty = validateEventForm(emptyEventForm);
    expect(empty.errors).toMatchObject({
      title: 'Title is required.',
      eventType: 'Event type is required.',
      eventDate: 'Event date is required.',
    });

    const invalidDate = validateEventForm({
      ...emptyEventForm,
      title: 'Dinner',
      eventType: 'Dinner',
      eventDate: '2026-02-30',
    });
    expect(invalidDate.errors.eventDate).toContain('valid');
  });

  it('trims strings, converts blank optional fields to null, and preserves coordinates', () => {
    const result = validateEventForm({
      ...emptyEventForm,
      title: '  Garden Dinner ',
      eventType: ' Dinner ',
      eventDate: '2026-10-12',
      latitude: '33.8938000',
      longitude: '35.5018000',
    });
    expect(result.errors).toEqual({});
    expect(result.input).toMatchObject({
      title: 'Garden Dinner',
      eventType: 'Dinner',
      description: null,
      latitude: 33.8938,
      longitude: 35.5018,
    });
  });

  it('rejects out-of-range coordinates and excessive precision', () => {
    const base = {
      ...emptyEventForm,
      title: 'Dinner',
      eventType: 'Dinner',
      eventDate: '2026-10-12',
    };
    expect(validateEventForm({ ...base, latitude: '91' }).errors.latitude).toContain('between');
    expect(validateEventForm({ ...base, longitude: '35.12345678' }).errors.longitude).toContain(
      '7 decimal'
    );
  });

  it('populates every editable field from an existing event', () => {
    const values = eventToForm({
      id: 'event-1',
      invitationId: 'invitation-1',
      title: 'Dinner',
      eventType: 'Gathering',
      description: 'Details',
      eventDate: '2026-10-12',
      startTime: '18:30',
      endTime: '21:00',
      venueName: 'Garden',
      venueAddress: 'Main Street',
      latitude: 33.8,
      longitude: 35.5,
      createdAt: '',
      updatedAt: '',
    });
    expect(values).toMatchObject({
      title: 'Dinner',
      description: 'Details',
      startTime: '18:30',
      latitude: '33.8',
    });
  });
});
