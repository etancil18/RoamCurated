"use client"

import type { AnchorHTMLAttributes, ReactNode } from "react"

interface Props extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  children: ReactNode
}

export default function ExternalLink({
  href,
  children,
  className,
  ...rest
}: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      {...rest}
    >
      {children}
    </a>
  )
}