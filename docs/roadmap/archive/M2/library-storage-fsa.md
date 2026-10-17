# library-storage-fsa

Tag: prep
Milestone: M2
Title: library on the file system

## Scope

- [x] File System Access adapter passing the shared contract suite
- [x] Library layout (`library.json`, `books/<id>/book.json`), writes via writable stream + `.bak` rotation, migrations on load
- [x] Load (parse, Zod, migrations) in a worker; serialization cost benchmarked on a 1000-asset book
