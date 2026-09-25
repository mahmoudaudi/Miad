-- Index the foreign-key side used by invitation guest lists and RSVP identity lookup.
CREATE INDEX "guests_invitation_id_idx" ON "guests"("invitation_id");
