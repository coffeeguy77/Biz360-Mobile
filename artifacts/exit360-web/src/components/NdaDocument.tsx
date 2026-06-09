interface NdaDocumentProps {
  listingName: string;
  buyerPhone?: string;
  agreed: boolean;
  onAgreeChange: (agreed: boolean) => void;
}

export function NdaDocument({ listingName, buyerPhone, agreed, onAgreeChange }: NdaDocumentProps) {
  const today = new Date().toLocaleString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return (
    <div className="text-[11px] text-muted-foreground leading-relaxed space-y-2.5 max-h-60 overflow-y-auto pr-1 border border-border rounded-xl p-3 bg-background/50">
      <p className="font-semibold text-foreground text-xs">Non-Disclosure Agreement</p>
      <p>
        This Confidentiality Agreement ("Agreement") is entered into as of{" "}
        <strong>{today}</strong> between you ("Recipient") and the seller of{" "}
        <strong>{listingName}</strong> ("Disclosing Party"), facilitated by EXIT360 Pty Ltd
        (ABN to be disclosed upon request).
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
        Verification of your mobile number via one-time password (OTP) constitutes a valid and
        binding electronic signature under the <em>Electronic Transactions Act 1999</em> (Cth)
        and equivalent state legislation.
      </p>
      <p>
        <strong>8. Identity Verification.</strong> Recipient's identity is verified via an OTP
        delivered to their Australian mobile number through a carrier operating under the{" "}
        <em>Telecommunications Act 1997</em> (Cth). Delivery of the OTP to Recipient's registered
        mobile device constitutes identity verification for the purposes of this Agreement.
      </p>

      <div className="border-t border-border pt-2.5 space-y-1">
        <p className="font-semibold text-foreground text-xs">Signature Block</p>
        <p>Listing: <strong>{listingName}</strong></p>
        {buyerPhone
          ? <p>Mobile: <strong>{buyerPhone}</strong> — to be verified via SMS OTP</p>
          : <p className="text-muted-foreground/60 italic">Enter your mobile number below to proceed</p>}
        <p>Date / Time: <strong>{today}</strong></p>
        <p className="text-muted-foreground/60 italic">Your IP address and device information will be recorded at time of signing.</p>
      </div>

      <label className="flex items-start gap-2 cursor-pointer select-none border border-border rounded-lg p-2.5 bg-primary/5 hover:bg-primary/10 transition-colors">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => onAgreeChange(e.target.checked)}
          className="mt-0.5 accent-primary flex-shrink-0"
        />
        <span className="text-foreground font-medium">
          I have read and agree to this Non-Disclosure Agreement. I understand my mobile number will be verified via SMS and my electronic signature will be permanently recorded.
        </span>
      </label>
    </div>
  );
}
