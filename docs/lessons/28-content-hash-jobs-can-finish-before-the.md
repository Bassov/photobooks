# Lesson 28

Content-hash jobs can finish before the gallery flush inserts the asset — `patchAssetRecord` must merge into pending records / early patches, and `getAssetContentHash` must read those pending values. Otherwise Save persists assets without `contentHash`, Open/`ensureThumb` never hits DerivedCache, and filmstrip thumbs stay gray forever (fresh-session Open flake).
