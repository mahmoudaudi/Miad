# API overview

| Service    | Endpoint             | Result                                                    |
| ---------- | -------------------- | --------------------------------------------------------- |
| backend    | `GET /api/v1/health` | `{ status: "ok", service: "api", timestamp }`             |
| ai-service | `GET /health`        | `{ status: "ok", service: "ai-service", provider }`       |
| ai-service | `GET /api/v1/health` | same as above (versioned alias) + router `/api/v1/health` |

Authentication endpoints:

| Method | Endpoint                | Purpose                                        |
| ------ | ----------------------- | ---------------------------------------------- |
| POST   | `/api/v1/auth/register` | Create a user and issue cookie tokens          |
| POST   | `/api/v1/auth/login`    | Authenticate and issue cookie tokens           |
| POST   | `/api/v1/auth/refresh`  | Consume/rotate the one-time refresh version    |
| POST   | `/api/v1/auth/logout`   | Invalidate the token version and clear cookies |
| GET    | `/api/v1/auth/me`       | Return the guarded current user                |

Event endpoints (all require an authenticated session and enforce ownership):

| Method | Endpoint             | Purpose                                  |
| ------ | -------------------- | ---------------------------------------- |
| GET    | `/api/v1/events`     | List the authenticated user's events     |
| POST   | `/api/v1/events`     | Create an event for the current user     |
| GET    | `/api/v1/events/:id` | Return an owned event                    |
| PATCH  | `/api/v1/events/:id` | Update an owned event                    |
| DELETE | `/api/v1/events/:id` | Delete an owned event (`204 No Content`) |

Missing and non-owned event IDs both return the same `404` response so ownership is not leaked.

Invitation endpoints (all require an authenticated session and derive ownership through the event):

| Method | Endpoint                              | Purpose                                          |
| ------ | ------------------------------------- | ------------------------------------------------ |
| GET    | `/api/v1/invitations`                 | List invitations owned through the user's events |
| POST   | `/api/v1/invitations`                 | Create one draft invitation for an owned event   |
| GET    | `/api/v1/invitations/:id`             | Return an invitation owned through its event     |
| PATCH  | `/api/v1/invitations/:id`             | Update the owned invitation slug                 |
| PATCH  | `/api/v1/invitations/:id/publication` | Publish or unpublish an owned invitation         |
| DELETE | `/api/v1/invitations/:id`             | Delete an owned invitation (`204 No Content`)    |

`GET /api/v1/invitations?eventId=<uuid>` provides the event-scoped list used by the UI. Missing
and non-owned invitation IDs return the same safe `404`. The existing one-to-one database constraint
allows only one invitation per event.

Invitation design endpoints (authenticated and owner-scoped through the invitation's event):

| Method | Endpoint                                   | Purpose                                        |
| ------ | ------------------------------------------ | ---------------------------------------------- |
| GET    | `/api/v1/invitations/:invitationId/design` | Return the active design, or `null` if unset   |
| POST   | `/api/v1/invitations/:invitationId/design` | Create the first design from a validated theme |
| PATCH  | `/api/v1/invitations/:invitationId/design` | Save a new active design version               |

Supported themes are `classic-ivory`, `modern-contrast`, and `romantic-blush`. The server stores
the complete controlled content, color, typography, and layout specification. `PATCH` accepts any
validated top-level editor group (or a theme), preserves inactive history, and activates the newly
created version. Missing and non-owned invitations use the same safe `404` response.

Guest endpoints (authenticated and owner-scoped through the event and invitation):

| Method | Endpoint                             | Purpose                                  |
| ------ | ------------------------------------ | ---------------------------------------- |
| GET    | `/api/v1/events/:eventId/guests`     | List guests and their current RSVP state |
| POST   | `/api/v1/events/:eventId/guests`     | Add a guest to the event invitation      |
| GET    | `/api/v1/events/:eventId/guests/:id` | Return one owned guest and RSVP          |
| PATCH  | `/api/v1/events/:eventId/guests/:id` | Update owned guest contact details       |
| DELETE | `/api/v1/events/:eventId/guests/:id` | Delete an owned guest and RSVP (`204`)   |

Events without an invitation return an empty guest list and require creating an invitation before
a guest can be added. Missing and non-owned event or guest resources return safe `404` responses.

Public invitation and RSVP endpoints:

| Method | Endpoint                                | Purpose                                          |
| ------ | --------------------------------------- | ------------------------------------------------ |
| GET    | `/api/v1/public/invitations/:slug`      | Return a published invitation's safe design only |
| POST   | `/api/v1/public/invitations/:slug/rsvp` | Record an anonymous RSVP for a published invite  |

Public endpoints require no session and return `404` for draft/unpublished, invalid, or missing
slugs. RSVP input accepts the existing `ATTENDING`, `PENDING`, and `NOT_ATTENDING` states, requires
an email or phone, enforces status-specific attendee counts, and is rate-limited. It accepts no
private resource IDs and returns only `{ status: "received" }`. A matching pre-added guest receives
the RSVP; an existing response for the same contact is rejected with `409`.
