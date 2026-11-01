import { Button } from '../ui/Button'
import { BookObject } from './BookObject'
import { LIBRARY_EXAMPLE_SRC } from './welcomeCredits'
import { WelcomePhotoCaption } from './WelcomePhotoCaption'

/** Empty library: example finished book + one text-only Create book action. */
export function LibraryEmpty({
  onCreate,
  createDisabled,
}: {
  onCreate: () => void
  createDisabled?: boolean
}) {
  return (
    <div
      className="pb-kit-type relative flex min-h-[520px] flex-1 items-center justify-center px-10 pb-10"
      style={{ gap: 'clamp(48px, 6vw, 110px)' }}
      data-testid="library-empty"
      data-home-empty=""
    >
      <figure
        className="pb-lib-rise m-0 shrink-0"
        aria-label="Example book"
        data-testid="example-book"
      >
        <BookObject
          src={LIBRARY_EXAMPLE_SRC}
          pos="60% 55%"
          title="Fog"
          sub="Autumn · 2025"
          h={440}
        />
        <figcaption className="mt-6 flex items-baseline gap-x-3 text-2xs uppercase tracking-[0.18em] text-muted-foreground">
          <span>Example</span>
          <WelcomePhotoCaption
            id="c18b"
            testid="screen-credit"
            className="normal-case tracking-normal"
          />
        </figcaption>
      </figure>
      <div className="pb-lib-rise pb-lib-rise--d15 max-w-[420px]">
        <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Your library is ready
        </div>
        <h1 className="pb-library-headline mt-4">
          Your first story
          <br />
          <em>starts here.</em>
        </h1>
        <p className="mt-5 mb-0 max-w-[380px] text-subhead leading-7 text-muted-foreground [text-wrap:pretty]">
          Create a book, then add a folder of photos in the editor and arrange
          the spreads your way.
        </p>
        <Button
          className="pb-lib-create mt-8"
          isDisabled={Boolean(createDisabled)}
          onPress={onCreate}
          data-testid="new-book"
        >
          Create book
        </Button>
      </div>
    </div>
  )
}
