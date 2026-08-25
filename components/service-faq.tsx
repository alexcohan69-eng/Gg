"use client"

import { useState } from "react"
import { ChevronDownIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/** Builds a small set of practical FAQs from the listing's own numbers, so answers stay accurate without per-service authoring. */
function buildFaqs(deliveryDays: number, fastestDeliveryDays: number, hasPackages: boolean) {
  const fastest = Math.min(deliveryDays, fastestDeliveryDays)
  return [
    {
      question: "How fast will I receive my order?",
      answer: hasPackages
        ? `Turnaround depends on the package you choose — the fastest tier delivers in ${fastest} ${fastest === 1 ? "day" : "days"}. Exact dates are confirmed once the brief is in.`
        : `Standard delivery is ${deliveryDays} ${deliveryDays === 1 ? "day" : "days"} from when the brief is confirmed. Rush timelines can be discussed before you order.`,
    },
    {
      question: "What do I need to provide to get started?",
      answer:
        "A short brief covering your goals, any brand or reference materials, and your deadline. The more context you share upfront, the fewer revision rounds you'll need.",
    },
    {
      question: "How many revisions are included?",
      answer: hasPackages
        ? "Revision rounds vary by package — check each tier's feature list above. Additional rounds beyond that can be arranged directly."
        : "A reasonable round of revisions is included to make sure the final result matches your brief. Larger scope changes may be quoted separately.",
    },
    {
      question: "How do we communicate during the project?",
      answer:
        "Everything happens through Pulse Messages — you'll get updates as work progresses and can share feedback or files at any point.",
    },
    {
      question: "What if I'm not satisfied with the result?",
      answer:
        "Reach out before closing the order — most concerns are resolved with a revision round. If something's off from the original brief, it'll be made right.",
    },
  ]
}

/** FAQ accordion for the service detail page, built from the listing's delivery/package data. */
export function ServiceFaq({
  deliveryDays,
  fastestDeliveryDays,
  hasPackages,
}: {
  deliveryDays: number
  fastestDeliveryDays: number
  hasPackages: boolean
}) {
  const faqs = buildFaqs(deliveryDays, fastestDeliveryDays, hasPackages)
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="border-t border-border pt-6">
      <h2 className="mb-3 font-heading text-sm font-semibold tracking-tight text-foreground">
        Frequently asked questions
      </h2>
      <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index
          return (
            <div key={faq.question}>
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
              >
                <span className="text-sm font-medium text-foreground text-pretty">{faq.question}</span>
                <ChevronDownIcon
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                    isOpen && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </button>
              <div
                className={cn(
                  "grid transition-all duration-200 ease-in-out",
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                )}
              >
                <div className="overflow-hidden">
                  <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground text-pretty">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
