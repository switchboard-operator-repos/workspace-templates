"use client";

import { Root as AspectRatioPrimitiveRoot } from "@radix-ui/react-aspect-ratio";

function AspectRatio({
  ...props
}: React.ComponentProps<typeof AspectRatioPrimitiveRoot>) {
  return <AspectRatioPrimitiveRoot data-slot="aspect-ratio" {...props} />;
}

export { AspectRatio };
