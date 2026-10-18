# Lesson 15

DerivedCache puts from `setThumbUrl` (encode-after-hash) must go through `trackHashJob` so Save/`awaitPendingHashes` cannot finish before OPFS writes — otherwise reload leaves gray filmstrip holes, worst at the gallery tail.
