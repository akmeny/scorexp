import type { SVGProps } from "react";

function FavoriteIconBase(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="favorite-icon"
      {...props}
    />
  );
}

export function MatchFavoriteIcon({
  active,
}: {
  active: boolean;
}) {
  if (active) {
    return (
      <FavoriteIconBase fill="currentColor" strokeWidth="1.2">
        <path d="m12 3.6 2.67 5.42 5.98.87-4.32 4.2 1.02 5.92L12 17.2 6.65 20l1.02-5.92-4.32-4.2 5.98-.87Z" />
      </FavoriteIconBase>
    );
  }

  return (
    <FavoriteIconBase>
      <path d="m12 3.6 2.67 5.42 5.98.87-4.32 4.2 1.02 5.92L12 17.2 6.65 20l1.02-5.92-4.32-4.2 5.98-.87Z" />
    </FavoriteIconBase>
  );
}

export function LeagueFavoriteIcon({
  active,
}: {
  active: boolean;
}) {
  if (active) {
    return (
      <FavoriteIconBase fill="currentColor" strokeWidth="1.2">
        <path d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15l-6.5-4-6.5 4V5A1.5 1.5 0 0 1 7 3.5Z" />
      </FavoriteIconBase>
    );
  }

  return (
    <FavoriteIconBase>
      <path d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15l-6.5-4-6.5 4V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="m8 17 8-10" />
    </FavoriteIconBase>
  );
}
