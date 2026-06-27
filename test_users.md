# Testing User Credentials — Mirror App

This file lists the 5 local testing accounts configured for development and debugging. You can switch between these users via the developer dropdown header in the React frontend.

The frontend will automatically pass the chosen user's UUID in the `x-user-id` header of every API request.

## Test User Profiles

| User Name | Simulated User ID (UUID) | Attachment Pattern / Design Accent |
|---|---|---|
| **Enkh** | `e1a8b9c8-1234-5678-abcd-ef0123456789` | Anxious-leaning |
| **Alex** | `f2b9c0d1-2345-6789-bcde-f0123456789a` | Avoidant-leaning |
| **Taylor** | `a3c0d1e2-3456-7890-cdef-0123456789ab` | Secure |
| **Jordan** | `b4d1e2f3-4567-8901-def0-123456789abc` | Fearful-avoidant (disorganized) |
| **Morgan** | `c5e2f3a4-5678-9012-ef01-23456789abcd` | Anxious-leaning |

## Database Integration

When seeding database tables or querying metrics from Supabase, filter by the `user_id` column matching one of the UUIDs above.

For example, a query to retrieve Enkh's recent journals:
```sql
SELECT * FROM journals WHERE user_id = 'e1a8b9c8-1234-5678-abcd-ef0123456789' ORDER BY created_at DESC;
```
