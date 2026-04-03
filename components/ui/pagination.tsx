import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

export function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return <nav aria-label="pagination" className={cn("mx-auto flex w-full justify-center", className)} {...props} />;
}

export function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("flex flex-row items-center gap-2", className)} {...props} />;
}

export function PaginationItem(props: React.ComponentProps<"li">) {
  return <li {...props} />;
}

type PaginationLinkProps = {
  isActive?: boolean;
} & React.ComponentProps<"a">;

export function PaginationLink({ className, isActive, ...props }: PaginationLinkProps) {
  return (
    <a
      aria-current={isActive ? "page" : undefined}
      className={cn(
        buttonVariants({
          variant: isActive ? "outline" : "ghost",
          size: "sm"
        }),
        "min-w-8 px-3",
        className
      )}
      {...props}
    />
  );
}

export function PaginationPrevious({
  className,
  children = "上一页",
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink aria-label="Go to previous page" className={cn("gap-1 pl-2.5", className)} {...props}>
      <ChevronLeft className="h-4 w-4" />
      <span>{children}</span>
    </PaginationLink>
  );
}

export function PaginationNext({
  className,
  children = "下一页",
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink aria-label="Go to next page" className={cn("gap-1 pr-2.5", className)} {...props}>
      <span>{children}</span>
      <ChevronRight className="h-4 w-4" />
    </PaginationLink>
  );
}

export function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span aria-hidden className={cn("flex h-9 w-9 items-center justify-center", className)} {...props}>
      <MoreHorizontal className="h-4 w-4" />
      <span className="sr-only">More pages</span>
    </span>
  );
}

export function PaginationInfo({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("text-sm text-zinc-500", className)} {...props}>
      {children}
    </div>
  );
}

export function PaginationButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return <Button className={cn("min-w-8", className)} size="sm" variant="outline" {...props} />;
}
