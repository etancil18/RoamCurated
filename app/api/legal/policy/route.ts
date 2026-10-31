
import { NextResponse } from 'next/server'
import { load } from 'cheerio'
import sanitizeHtml from 'sanitize-html'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

/* =========================================================
 * Roam Legal Policy API
 *
 * GET /api/legal/policy?policy=terms
 * GET /api/legal/policy?policy=community-guidelines
 * GET /api/legal/policy?policy=privacy
 *
 * Retrieves published HTML from Roam's company website,
 * isolates the policy content, sanitizes its HTML, and
 * returns content for the in-app LegalPolicyModal.
 *
 * Security:
 * - Strict policy allowlist
 * - Configured website origin only
 * - HTTPS required in production
 * - No automatic redirects
 * - Request timeout
 * - Response size limit
 * - HTML sanitization
 * - No scripts, iframes, styles, forms, or event handlers
 * - No caching of policy responses
 *
 * Does not:
 * - Authenticate users
 * - Create legal acceptance records
 * - Change signup behavior
 * - Modify Supabase data
 * ======================================================= */

type LegalPolicyKey =
  | 'terms'
  | 'community-guidelines'
  | 'privacy'

type LegalPolicyDefinition = {
  path: string
  title: string
}

type LegalPolicyResponse = {
  html: string
  effectiveDate: string | null
}

const LEGAL_POLICIES: Record<
  LegalPolicyKey,
  LegalPolicyDefinition
> = {
  terms: {
    path: '/terms',
    title: 'Terms of Service',
  },

  'community-guidelines': {
    path: '/community-guidelines',
    title: 'Community Guidelines',
  },

  privacy: {
    path: '/privacy',
    title: 'Privacy Policy',
  },
}

const REQUEST_TIMEOUT_MS = 8000

const MAX_RESPONSE_BYTES =
  1024 * 1024

const MAX_SANITIZED_HTML_LENGTH =
  500000

const NO_STORE_HEADERS = {
  'Cache-Control':
    'private, no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
}

/* =========================================================
 * GET
 * ======================================================= */

export async function GET(
  request: Request
) {
  const requestUrl =
    new URL(request.url)

  const policyKey =
    parseLegalPolicyKey(
      requestUrl.searchParams.get(
        'policy'
      )
    )

  if (!policyKey) {
    return errorResponse(
      'Invalid legal policy.',
      400
    )
  }

  const websiteOrigin =
    getConfiguredWebsiteOrigin()

  if (!websiteOrigin) {
    console.error(
      '[api/legal/policy] Legal website origin is missing or invalid.'
    )

    return errorResponse(
      'Legal policy service is not configured.',
      503
    )
  }

  const definition =
    LEGAL_POLICIES[policyKey]

  const policyUrl =
    new URL(
      definition.path,
      websiteOrigin
    )

  try {
    /* =====================================================
     * Retrieve published policy HTML
     * =================================================== */

    const response =
      await fetch(
        policyUrl.toString(),
        {
          method: 'GET',

          redirect: 'manual',

          cache: 'no-store',

          signal:
            AbortSignal.timeout(
              REQUEST_TIMEOUT_MS
            ),

          headers: {
            Accept:
              'text/html, application/xhtml+xml',
          },
        }
      )

    if (
      !response.ok
    ) {
      console.warn(
        '[api/legal/policy] Policy website returned an unsuccessful response:',
        {
          policy:
            policyKey,
          status:
            response.status,
        }
      )

      return errorResponse(
        'The requested policy is temporarily unavailable.',
        502
      )
    }

    /* =====================================================
     * Accept HTML only
     * =================================================== */

    const contentType =
      response.headers
        .get('content-type')
        ?.toLowerCase() ??
      ''

    const isHtml =
      contentType.includes(
        'text/html'
      ) ||
      contentType.includes(
        'application/xhtml+xml'
      )

    if (!isHtml) {
      console.error(
        '[api/legal/policy] Unexpected policy content type:',
        {
          policy:
            policyKey,
          contentType,
        }
      )

      return errorResponse(
        'The requested policy could not be displayed.',
        502
      )
    }

    /* =====================================================
     * Limit response size
     * =================================================== */

    const contentLengthHeader =
      response.headers.get(
        'content-length'
      )

    if (
      contentLengthHeader
    ) {
      const contentLength =
        Number(
          contentLengthHeader
        )

      if (
        Number.isFinite(
          contentLength
        ) &&
        contentLength >
          MAX_RESPONSE_BYTES
      ) {
        return errorResponse(
          'The requested policy is too large to display.',
          502
        )
      }
    }

    const sourceHtml =
      await readLimitedHtml(
        response,
        MAX_RESPONSE_BYTES
      )

    if (
      !sourceHtml.trim()
    ) {
      return errorResponse(
        'The requested policy is empty.',
        502
      )
    }

    /* =====================================================
     * Extract and sanitize policy content
     * =================================================== */

    const extractedHtml =
      extractPolicyContent(
        sourceHtml
      )

    if (
      !extractedHtml
    ) {
      console.error(
        '[api/legal/policy] Could not locate policy document content:',
        {
          policy:
            policyKey,
        }
      )

      return errorResponse(
        'The policy document could not be identified on Roam’s website.',
        502
      )
    }

    const sanitizedHtml =
      sanitizePolicyHtml(
        extractedHtml,
        policyUrl
      )

    if (
      !sanitizedHtml ||
      sanitizedHtml.length >
        MAX_SANITIZED_HTML_LENGTH
    ) {
      return errorResponse(
        'The policy document could not be safely displayed.',
        502
      )
    }

    /* =====================================================
     * Return sanitized policy
     *
     * The effective date is intentionally null because
     * it must not be inferred from arbitrary page text.
     *
     * When a verified, versioned policy metadata source
     * exists, its effective date can be returned here.
     * =================================================== */

    const payload:
      LegalPolicyResponse = {
        html:
          sanitizedHtml,

        effectiveDate:
          null,
      }

    return NextResponse.json(
      payload,
      {
        status: 200,

        headers:
          NO_STORE_HEADERS,
      }
    )
  } catch (error) {
    console.error(
      '[api/legal/policy] Failed to retrieve policy:',
      {
        policy:
          policyKey,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      }
    )

    return errorResponse(
      'The requested policy is temporarily unavailable.',
      502
    )
  }
}

/* =========================================================
 * Policy identifier allowlist
 * ======================================================= */

function parseLegalPolicyKey(
  value: string | null
): LegalPolicyKey | null {
  if (
    value === 'terms' ||
    value ===
      'community-guidelines' ||
    value === 'privacy'
  ) {
    return value
  }

  return null
}

/* =========================================================
 * Configured company website
 *
 * The endpoint never accepts a website URL from the
 * request itself.
 *
 * Only the configured company website may be fetched.
 * ======================================================= */

function getConfiguredWebsiteOrigin():
  string | null {
  const configured =
    process.env
      .NEXT_PUBLIC_ROAM_LEGAL_BASE_URL
      ?.trim()

  if (!configured) {
    return null
  }

  try {
    const url =
      new URL(configured)

    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null
    }

    const isHttps =
      url.protocol ===
      'https:'

    const isDevelopmentHttp =
      process.env.NODE_ENV !==
        'production' &&
      url.protocol ===
        'http:' &&
      (
        url.hostname ===
          'localhost' ||
        url.hostname ===
          '127.0.0.1'
      )

    if (
      !isHttps &&
      !isDevelopmentHttp
    ) {
      return null
    }

    return url.origin
  } catch {
    return null
  }
}

/* =========================================================
 * Bounded HTML reader
 *
 * Limits the number of response bytes consumed.
 * ======================================================= */

async function readLimitedHtml(
  response: Response,
  maxBytes: number
): Promise<string> {
  if (!response.body) {
    throw new Error(
      'Policy response has no readable body.'
    )
  }

  const reader =
    response.body.getReader()

  const decoder =
    new TextDecoder()

  let totalBytes =
    0

  let html =
    ''

  try {
    while (true) {
      const {
        done,
        value,
      } =
        await reader.read()

      if (done) {
        break
      }

      totalBytes +=
        value.byteLength

      if (
        totalBytes >
        maxBytes
      ) {
        throw new Error(
          'Policy response exceeded the maximum allowed size.'
        )
      }

      html += decoder.decode(
        value,
        {
          stream: true,
        }
      )
    }

    html += decoder.decode()

    return html
  } finally {
    await reader
      .cancel()
      .catch(() => undefined)
  }
}

/* =========================================================
 * Policy content extraction
 *
 * Prefer dedicated legal content containers.
 *
 * Do not return the entire website document, since
 * it may contain navigation, account forms, scripts,
 * and unrelated page content.
 * ======================================================= */

function extractPolicyContent(
  sourceHtml: string
): string | null {
  const $ =
    load(sourceHtml)

  const selectors = [
    '[data-legal-policy-content]',
    '[data-policy-content]',
    '.legal-policy-content',
    '.policy-content',
    '.entry-content',
    'main article',
    'article',
    'main',
    '[role="main"]',
  ]

  for (
    const selector
    of selectors
  ) {
    const candidate =
      $(selector).first()

    if (
      candidate.length ===
      0
    ) {
      continue
    }

    const clonedContent =
      candidate.clone()

    clonedContent.find(
      [
        'script',
        'style',
        'noscript',
        'template',
        'iframe',
        'object',
        'embed',
        'form',
        'nav',
        'footer',
        'aside',
        'button',
        'input',
        'select',
        'textarea',
      ].join(', ')
    ).remove()

    const html =
      clonedContent.html() ??
      ''

    const text =
      clonedContent.text()
        .replace(
          /\s+/g,
          ' '
        )
        .trim()

    if (
      html.trim() &&
      text.length >= 80
    ) {
      return html
    }
  }

  return null
}

/* =========================================================
 * HTML sanitization
 *
 * Strict document-focused allowlist.
 *
 * No script execution, event handlers, inline styles,
 * forms, iframes, SVG, or arbitrary embeds.
 *
 * Links are resolved against the company's published
 * policy URL and restricted to safe destinations.
 * ======================================================= */

function sanitizePolicyHtml(
  html: string,
  policyUrl: URL
): string {
  const sanitized =
    sanitizeHtml(
      html,
      {
        allowedTags: [
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'p',
          'br',
          'hr',
          'strong',
          'b',
          'em',
          'i',
          'u',
          's',
          'small',
          'span',
          'div',
          'section',
          'article',
          'ul',
          'ol',
          'li',
          'blockquote',
          'pre',
          'code',
          'a',
          'table',
          'thead',
          'tbody',
          'tfoot',
          'tr',
          'th',
          'td',
          'caption',
          'sup',
          'sub',
          'dl',
          'dt',
          'dd',
        ],

        allowedAttributes: {
          a: [
            'href',
            'target',
            'rel',
          ],

          th: [
            'colspan',
            'rowspan',
            'scope',
          ],

          td: [
            'colspan',
            'rowspan',
          ],
        },

        allowedSchemes: [
          'https',
          'http',
          'mailto',
        ],

        allowedSchemesAppliedToAttributes: [
          'href',
        ],

        allowProtocolRelative:
          false,

        disallowedTagsMode:
          'discard',

        nonTextTags: [
          'script',
          'style',
          'textarea',
          'option',
          'noscript',
          'template',
        ],

        transformTags: {
            a: (
                _tagName,
                attributes
            ): sanitizeHtml.Tag => {
            const href =
              attributes.href
                ?.trim()

            if (!href) {
              return {
                tagName:
                  'span',

                attribs: {},
              }
            }

            if (
              href.startsWith(
                '#'
              )
            ) {
              return {
                tagName:
                  'a',

                attribs: {
                  href,
                },
              }
            }

            if (
              href.toLowerCase()
                .startsWith(
                  'mailto:'
                )
            ) {
              return {
                tagName:
                  'a',

                attribs: {
                  href,
                },
              }
            }

            try {
              const resolved =
                new URL(
                  href,
                  policyUrl
                )

              if (
                resolved.protocol !==
                  'https:' &&
                resolved.protocol !==
                  'http:'
              ) {
                return {
                  tagName:
                    'span',

                  attribs: {},
                }
              }

              return {
                tagName:
                  'a',

                attribs: {
                  href:
                    resolved.toString(),

                  target:
                    '_blank',

                  rel:
                    'noopener noreferrer',
                },
              }
            } catch {
              return {
                tagName:
                  'span',

                attribs: {},
              }
            }
          },
        },
      }
    ).trim()

  /* =====================================================
   * Verify meaningful document text survived sanitization.
   * =================================================== */

  const $ =
    load(
      `<div id="roam-policy-result">${sanitized}</div>`
    )

  const visibleText =
    $('#roam-policy-result')
      .text()
      .replace(
        /\s+/g,
        ' '
      )
      .trim()

  if (
    visibleText.length <
    80
  ) {
    return ''
  }

  return sanitized
}

/* =========================================================
 * Standard API errors
 * ======================================================= */

function errorResponse(
  message: string,
  status: number
) {
  return NextResponse.json(
    {
      error:
        message,
    },
    {
      status,

      headers:
        NO_STORE_HEADERS,
    }
  )
}
