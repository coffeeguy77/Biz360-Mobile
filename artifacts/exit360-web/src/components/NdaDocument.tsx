interface NdaDocumentProps {
  businessName: string;
  buyerPhone?: string;
}

export function NdaDocument({ businessName, buyerPhone }: NdaDocumentProps) {
  const today = new Date().toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="text-[11px] text-muted-foreground leading-relaxed space-y-2.5 max-h-48 overflow-y-auto pr-1 border border-border rounded-xl p-3 bg-background/50">
      <p className="font-semibold text-foreground text-xs">Non-Disclosure Agreement</p>
      <p>
        This Confidentiality Agreement ("Agreement") is entered into as of{" "}
        <strong>{today}</strong> between you ("Recipient") and the seller of{" "}
        <strong>{businessName}</strong> ("Disclosing Party"), facilitated by EXIT360 Pty Ltd (ABN to be disclosed upon request).
      </p>
      <p>
        <strong>1. Confidential Information.</strong> "Confidential Information" means all
        financial data, revenue figures, profit & loss statements, operational details, customer
        lists, supplier terms, lease arrangements, employee records, and any other non-public
        information disclosed about this business in connection with a potential acquisition.
      </p>
      <p>
        <strong>2. Obligation of Confidentiality.</strong> Recipient agrees to: (a) keep all
        Confidential Information strictly confidential; (b) not disclose it to any third party
        without prior written consent; (c) use it solely for the purpose of evaluating a
        potential acquisition of this business; and (d) protect it with at least the same degree
        of care used for Recipient's own confidential information, but in no event less than
        reasonable care.
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
        Party may seek injunctive relief in any competent court without posting bond.
      </p>
      <p>
        <strong>6. Governing Law & Jurisdiction.</strong> This Agreement is governed exclusively
        by the laws of New South Wales, Australia. Each party irrevocably submits to the
        non-exclusive jurisdiction of courts in New South Wales for any dispute arising under
        this Agreement.
      </p>
      <p>
        <strong>7. Electronic Execution.</strong> This Agreement may be executed electronically.
        Verification of your mobile number via SMS one-time password constitutes a valid and
        binding electronic signature under the <em>Electronic Transactions Act 1999</em> (Cth)
        and equivalent state legislation. Your IP address, device user-agent, and mobile number
        will be recorded as evidence of execution.
      </p>
      <p className="text-muted-foreground/70 italic border-t border-border pt-2">
        Signed electronically via EXIT360 · {today}
        {buyerPhone ? ` · Mobile: ${buyerPhone}` : ""}
      </p>
    </div>
  );
}
