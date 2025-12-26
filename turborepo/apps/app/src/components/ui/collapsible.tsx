"use client";

import {
  CollapsibleContent as CollapsiblePrimitiveCollapsibleContent,
  CollapsibleTrigger as CollapsiblePrimitiveCollapsibleTrigger,
  Root as CollapsiblePrimitiveRoot,
} from "@radix-ui/react-collapsible";

function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitiveRoot>) {
  return <CollapsiblePrimitiveRoot data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitiveCollapsibleTrigger>) {
  return (
    <CollapsiblePrimitiveCollapsibleTrigger
      data-slot="collapsible-trigger"
      {...props}
    />
  );
}

function CollapsibleContent({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitiveCollapsibleContent>) {
  return (
    <CollapsiblePrimitiveCollapsibleContent
      data-slot="collapsible-content"
      {...props}
    />
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
