# What is `sync_queue`?

`sync_queue` is part of the offline sync strategy. It holds mutations made while
the user is offline so they can be replayed against Neon once they're back online.

## How it works

If a user marks 10 articles as read while on a plane, those actions get written
to `sync_queue` locally (in PGlite) instead of failing silently. When the connection
returns, the queue flushes and each action is sent to the server API which applies
them to Neon.

```
User offline     →  marks article as read
                 →  writes to local sync_queue { action: 'markRead', payload: '{"guid": "abc"}' }

User back online →  flushes queue
                 →  POST /api/sync for each pending row
                 →  sets synced_at once confirmed
```

## When to drop it

If your app doesn't need offline state sync — meaning users are always online when
they interact with it and you're only using PGlite for local caching — you can
remove this table entirely. It's only necessary if you want actions taken offline
to survive and sync later.
