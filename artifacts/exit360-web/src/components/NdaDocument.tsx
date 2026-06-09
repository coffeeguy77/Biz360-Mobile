interface NdaDocumentProps {
  businessName: string;
}

export function NdaDocument({ businessName }: NdaDocumentProps) {
  const today = new Date().toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="text-[11px] text-muted-foreground leading-relaxed space-y-2.5 max-h-44 overflow-y-auto pr-1 border border-border rounded-xl p-3 bg-background/50">
      <p className="font-semibold text-foreground text-xs">Non-Disclosure Agreement</p>
      <p>
        This Confidentiality Agreement ("Agreement") is entered into as of{" "}
        <strong>{today}</strong> between you ("Recipient") and the seller of{" "}
        <strong>{businessName}</strong> ("Disclosing Party"), facilitated by EXIT360.
      </p>
      <p>
        <strong>1. Confidential Information.</strong> "Confidential Information" means all
        financial data, revenue figures, profit & loss statements, operational details, customer
        lists, supplier terms, lease arrangements, and any other non-public information disclosed
        about this business in connection with a potential acquisition.
      </p>
      <p>
        <strong>2. Obligation of Confidentiality.</strong> Recipient agrees to: (a) keep all
        Confidential Information strictly confidential; (b) not disclose it to any third party
        without prior written consent; (c) use it solely for the purpose of evaluating a
        potential acquisition of this business; and (d) protect it with at least the same degree
        of care used for Recipient's own confidential information.
      </p>
      <p>
        <strong>3. No Solicitation.</strong> Recipient agrees not to directly or indirectly
        solicit any employees, suppliers, or customers of the business during and for 12 months
        following any disclosure.
      </p>
      <p>
        <strong>4. Term.</strong> These obligations survive for 2 years from the date of this
        Agreement, or until the Confidential Information becomes publicly available through no
        fault of Recipient.
      </p>
      <p>
        <strong>5. Remedies.</strong> Recipient acknowledges that breach of this Agreement may
        cause irreparable harm for which monetary damages are insufficient, and the Disclosing
        Party may seek injunctive relief without posting bond.
      </p>
      <p>
        <strong>6. Governing Law.</strong> This Agreement is governed by the laws of New South
        Wales, Australia.
      </p>
      <p className="text-muted-foreground/60 italic">
        Signed electronically via EXIT360 · {today}
      </p>
    </div>
  );
}
