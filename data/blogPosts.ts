export type BlogPost = {
  id: string;
  date: string; // ISO date
  title: { en: string; de: string; vi: string };
  excerpt: { en: string; de: string; vi: string };
  content: { en: string; de: string; vi: string }; // HTML string
  coverImage?: string;
  tags?: string[];
  author?: { name: string; avatar?: string };
};

export const blogPosts: BlogPost[] = [
  {
    id: "finance-deductions-2025",
    date: "2025-01-10",
    title: {
      en: "Top Tax Deductions for 2025 in Germany",
      de: "Top Steuerabzüge für 2025 in Deutschland",
      vi: "Các khoản khấu trừ thuế hàng đầu 2025 ở Đức",
    },
    excerpt: {
      en: "Essential deductions every individual and small business should know for 2025 — with documentation tips and examples.",
      de: "Wesentliche Abzüge, die Privatpersonen und Kleinunternehmen 2025 kennen sollten — mit Dokumentationstipps und Beispielen.",
      vi: "Những khoản khấu trừ thiết yếu mà cá nhân và doanh nghiệp nhỏ nên biết cho năm 2025 — kèm hướng dẫn chứng từ và ví dụ.",
    },
    content: {
      en: `
        <article>
          <p><strong>Overview</strong> — Germany's tax system continues to offer practical deduction opportunities for employees, freelancers and small businesses. Correct classification and documentation can significantly reduce your tax bill.</p>

          <h3>What to check first</h3>
          <p>Start by collecting receipts and records for the whole tax year. Group them into work-related expenses, special expenses, and business costs.</p>

          <h4>Practical deduction categories</h4>
          <ul>
            <li><strong>Work-related expenses (Werbungskosten)</strong>: commuting, professional literature, dual-household costs.</li>
            <li><strong>Special expenses (Sonderausgaben)</strong>: insurance premiums, donations, education-related costs.</li>
            <li><strong>Business expenses (Betriebsausgaben)</strong>: tools, software subscriptions, client meetings.</li>
            <li><strong>Home office</strong>: document hours and purpose carefully; keep a workspace record and supporting invoices.</li>
          </ul>

          <h4>Documentation tips</h4>
          <ol>
            <li>Keep digital copies (PDF/photo) named by date and category.</li>
            <li>Use a simple spreadsheet or bookkeeping app to track totals monthly.</li>
            <li>When in doubt, consult a finance professional — small classification changes can matter.</li>
          </ol>

          <p><strong>Need help?</strong> If you want a personalized review of your deductible expenses and how to document them correctly, <a href="/__LOCALE__/contact" class="text-blue-600 underline">book a consultation</a> or call our hotline: +49 30 1234 5678.</p>
        </article>
      `,
      de: `
        <article>
          <p><strong>Übersicht</strong> — Das deutsche Finanzrecht bietet weiterhin praxisnahe Abzugsmöglichkeiten für Arbeitnehmer, Freiberufler und Kleinunternehmer. Eine korrekte Zuordnung und Dokumentation kann Ihre Finanzlast deutlich senken.</p>

          <h3>Worauf Sie zuerst achten sollten</h3>
          <p>Sammeln Sie Belege für das gesamte Finanzyahr und ordnen Sie diese in Werbungskosten, Sonderausgaben und Betriebsausgaben ein.</p>

          <h4>Wichtige Abzugsbereiche</h4>
          <ul>
            <li><strong>Werbungskosten</strong>: Fahrtkosten, Fachliteratur, doppelte Haushaltsführung.</li>
            <li><strong>Sonderausgaben</strong>: Versicherungsbeiträge, Spenden, Fortbildungskosten.</li>
            <li><strong>Betriebsausgaben</strong>: Arbeitsmittel, Software-Abos, Kundentermine.</li>
            <li><strong>Homeoffice</strong>: Dokumentieren Sie Stunden und Zweck, und heben Sie Rechnungen auf.</li>
          </ul>

          <h4>Tipps zur Dokumentation</h4>
          <ol>
            <li>Digitale Kopien (PDF/Foto) mit Datum und Kategorie ablegen.</li>
            <li>Monatliche Übersicht in einer Tabelle oder Buchhaltungs-App führen.</li>
            <li>Bei Unsicherheiten finanzielle Beratung hinzuziehen — kleine Zuordnungsunterschiede können viel ausmachen.</li>
          </ol>

          <p><strong>Brauchen Sie Unterstützung?</strong> Für eine individuelle Prüfung Ihrer Abzugsfähigkeit und Dokumentation <a href="/__LOCALE__/contact" class="text-blue-600 underline">vereinbaren Sie einen Termin</a> oder rufen Sie unsere Hotline an: +49 30 1234 5678.</p>
        </article>
      `,
      vi: `
        <article>
          <p><strong>Tổng quan</strong> — Hệ thống thuế tại Đức cung cấp nhiều cơ hội khấu trừ thực tế cho người lao động, freelancer và doanh nghiệp nhỏ. Phân loại và lưu trữ chứng từ đúng cách có thể giảm đáng kể số thuế phải nộp.</p>

          <h3>Nên kiểm tra điều gì trước tiên</h3>
          <p>Thu thập hoá đơn/chứng từ trong cả năm tài chính và chia thành chi phí liên quan công việc, chi phí đặc biệt và chi phí doanh nghiệp.</p>

          <h4>Các mục khấu trừ quan trọng</h4>
          <ul>
            <li><strong>Chi phí liên quan công việc</strong>: chi phí đi lại, sách chuyên môn, chi phí nhà ở kép.</li>
            <li><strong>Chi phí đặc biệt</strong>: đóng bảo hiểm, quyên góp, chi phí đào tạo.</li>
            <li><strong>Chi phí doanh nghiệp</strong>: thiết bị làm việc, đăng ký phần mềm, gặp khách hàng.</li>
            <li><strong>Home office</strong>: ghi chép giờ làm việc và mục đích; lưu hoá đơn liên quan.</li>
          </ul>

          <h4>Mẹo lưu trữ chứng từ</h4>
          <ol>
            <li>Lưu bản sao điện tử (PDF/ảnh) theo ngày và theo loại.</li>
            <li>Theo dõi tổng chi phí hàng tháng bằng bảng tính hoặc ứng dụng kế toán.</li>
            <li>Nếu băn khoăn, nên hỏi chuyên gia thuế — việc phân loại chính xác có thể ảnh hưởng lớn.</li>
          </ol>

          <p><strong>Cần trợ giúp?</strong> Nếu muốn kiểm tra cá nhân các khoản được khấu trừ và cách lưu chứng từ chính xác, <a href="/__LOCALE__/contact" class="text-blue-600 underline">đặt lịch tư vấn</a> hoặc gọi hotline: +49 30 1234 5678.</p>
        </article>
      `,
    },
    coverImage: "https://images.unsplash.com/photo-1523289333742-bea4c7c0a2e6?auto=format&fit=crop&w=1400&q=80",
    tags: ["Taxes", "Freelancer", "Deductions"],
    author: { name: "Finance Consulting" },
  },
  {
    id: "company-setup-germany",
    date: "2025-02-05",
    title: {
      en: "Setting Up a Business in Germany: A Practical Checklist",
      de: "Unternehmensgründung in Deutschland: Eine praktische Checkliste",
      vi: "Thành lập doanh nghiệp tại Đức: Checklist thực tế",
    },
    excerpt: {
      en: "Clear steps for registration, tax IDs and avoiding common pitfalls when starting a company in Germany.",
      de: "Klare Schritte für Anmeldung, Steuernummern und häufige Fallstricke bei der Gründung in Deutschland.",
      vi: "Các bước rõ ràng để đăng ký, mã số thuế và tránh rủi ro khi thành lập công ty ở Đức.",
    },
    content: {
      en: `
        <article>
          <p>Founding a company in Germany is straightforward if you follow the main steps: choose a legal form, register your trade, register with the finance office and handle VAT if applicable.</p>

          <h4>Step-by-step checklist</h4>
          <ul>
            <li>Choose legal form: GmbH, UG, GbR, or sole proprietorship; consider liability and capital requirements.</li>
            <li>Register at the Gewerbeamt (trade office).</li>
            <li>Register with the Finanzamt to receive a finance ID and VAT registration where necessary.</li>
            <li>Set up bookkeeping and open a business bank account.</li>
            <li>Consider insurance, payroll setup and local permits.</li>
          </ul>

          <p>We offer a hands-on onboarding package for non-German founders — from paperwork to finance registration. <a href="/__LOCALE__/contact" class="text-blue-600 underline">Book an appointment</a> to get a tailored checklist for your business.</p>
        </article>
      `,
      de: `
        <article>
          <p>Die Gründung eines Unternehmens in Deutschland ist gut planbar: Rechtsform wählen, Gewerbeanmeldung, Registrierung beim Finanzamt und gegebenenfalls USt-Registrierung.</p>

          <h4>Checkliste – Schritt für Schritt</h4>
          <ul>
            <li>Rechtsform wählen: GmbH, UG, GbR oder Einzelunternehmen; Haftung und Kapitalbedarf beachten.</li>
            <li>Gewerbe beim Gewerbeamt anmelden.</li>
            <li>Beim Finanzamt registrieren lassen (Steuernummer, ggf. USt-ID).</li>
            <li>Buchführung organisieren und Geschäftskonto eröffnen.</li>
            <li>Versicherungen, Gehaltsabrechnung und lokale Genehmigungen prüfen.</li>
          </ul>

          <p>Wir bieten ein Onboarding-Paket für ausländische Gründer — von behördlichen Schritten bis zur Finanzregistrierung. <a href="/__LOCALE__/contact" class="text-blue-600 underline">Vereinbaren Sie einen Termin</a> für eine individuelle Checkliste.</p>
        </article>
      `,
      vi: `
        <article>
          <p>Thành lập doanh nghiệp tại Đức có thể được chuẩn bị kỹ lưỡng: chọn loại hình pháp lý, đăng ký kinh doanh, đăng ký tại cơ quan thuế và đăng ký VAT nếu cần.</p>

          <h4>Checklist – Các bước</h4>
          <ul>
            <li>Chọn loại hình: GmbH, UG, GbR hoặc doanh nghiệp tư nhân; cân nhắc rủi ro trách nhiệm và vốn.</li>
            <li>Đăng ký kinh doanh tại Gewerbeamt.</li>
            <li>Đăng ký tại Finanzamt để nhận mã số thuế và đăng ký VAT nếu cần.</li>
            <li>Tổ chức kế toán và mở tài khoản doanh nghiệp.</li>
            <li>Xem xét bảo hiểm, tiền lương và giấy phép địa phương.</li>
          </ul>

          <p>Chúng tôi cung cấp gói hỗ trợ cho nhà sáng lập nước ngoài — từ thủ tục đến đăng ký thuế. <a href="/__LOCALE__/contact" class="text-blue-600 underline">Đặt lịch</a> để nhận checklist phù hợp cho doanh nghiệp của bạn.</p>
        </article>
      `,
    },
    coverImage: "https://images.unsplash.com/photo-1498079022511-d15614cb1c02?auto=format&fit=crop&w=1400&q=80",
    tags: ["Business", "Startups", "Registration"],
    author: { name: "Finance Consulting" },
  },
  {
    id: "freelancer-finance-tips",
    date: "2025-02-15",
    title: {
      en: "Freelancer Finance Tips: Organize, Plan & Save",
      de: "Tipps zur Freelancer-Finanzplanung: Organisieren, Planen & Sparen",
      vi: "Hướng dẫn Tài chính Freelancer: Tổ chức, Lập kế hoạch & Tiết kiệm",
    },
    excerpt: {
      en: "Organize expenses, invoicing and finance planning to legally reduce taxable income — practical tips and tools.",
      de: "Ausgaben, Rechnungsstellung und Finanzplanung organisieren, um steuerpflichtiges Einkommen legal zu senken — praktische Tipps und Tools.",
      vi: "Tổ chức chi phí, hóa đơn và lập kế hoạch tài chính để giảm thu nhập chịu thuế hợp pháp — hướng dẫn thực tế và công cụ.",
    },
    content: {
      en: `
        <article>
          <p>Freelancers benefit from strict bookkeeping, timely invoices and sensible finance provisions. Small changes in routine accounting can yield substantial yearly savings.</p>

          <h4>Quick wins</h4>
          <ul>
            <li>Track all business expenses monthly and keep receipts.</li>
            <li>Invoice with clear payment terms and VAT details where required.</li>
            <li>Make quarterly finance prepayments and set aside a finance reserve.</li>
            <li>Consider pension and health insurance options early.</li>
          </ul>

          <p>For a tailored review of your bookkeeping and finance plan, <a href="/__LOCALE__/contact" class="text-blue-600 underline">book a consultation</a> or call our hotline: +49 30 1234 5678.</p>
        </article>
      `,
      de: `
        <article>
          <p>Freiberufler profitieren von sauberer Buchführung, zeitnahen Rechnungen und sinnvollen Finanz-Rücklagen. Kleine Änderungen in der täglichen Buchhaltung können erhebliche Einsparungen bringen.</p>

          <h4>Schnelle Maßnahmen</h4>
          <ul>
            <li>Monatlich alle Betriebsausgaben erfassen und Belege sammeln.</li>
            <li>Rechnungen mit klaren Zahlungsbedingungen und USt-Angaben erstellen.</li>
            <li>Vierteljährliche Finanz-Vorauszahlungen berücksichtigen và Rücklagen bilden.</li>
            <li>Frühzeitig Renten- und Krankenversorgungsoptionen prüfen.</li>
          </ul>

          <p>Für eine individuelle Prüfung Ihrer Buchführung và Finanzplanung <a href="/__LOCALE__/contact" class="text-blue-600 underline">vereinbaren Sie eine Beratung</a> oder rufen Sie unsere Hotline an: +49 30 1234 5678.</p>
        </article>
      `,
      vi: `
        <article>
          <p>Freelancer được lợi từ việc ghi chép kế toán rõ ràng, gửi hoá đơn kịp thời và để dành khoản thuế hợp lý. Những thay đổi nhỏ trong quy trình hàng ngày có thể tiết kiệm đáng kể hàng năm.</p>

          <h4>Mẹo nhanh</h4>
          <ul>
            <li>Theo dõi chi phí kinh doanh hàng tháng và lưu hoá đơn.</li>
            <li>Lập hoá đơn với điều khoản thanh toán rõ ràng và thông tin VAT khi cần.</li>
            <li>Dự phòng thanh toán thuế hàng quý và để dành quỹ thuế.</li>
            <li>Xem xét phương án bảo hiểm hưu trí và y tế sớm.</li>
          </ul>

          <p>Để được tư vấn chi tiết về kế toán và kế hoạch thuế, <a href="/__LOCALE__/contact" class="text-blue-600 underline">đặt lịch tư vấn</a> hoặc gọi hotline: +49 30 1234 5678.</p>
        </article>
      `,
    },
    coverImage: "https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?auto=format&fit=crop&w=1400&q=80",
    tags: ["Freelancer", "Bookkeeping", "Tips"],
    author: { name: "Finance Consulting" },
  },
];

export default blogPosts;
