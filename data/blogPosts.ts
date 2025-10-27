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
    id: "tax-deductions-2025",
    date: "2025-01-10",
    title: {
      en: "Top Tax Deductions for 2025 in Germany",
      de: "Top Steuerabzüge für 2025 in Deutschland",
      vi: "Các khoản khấu trừ thuế hàng đầu 2025 ở Đức",
    },
    excerpt: {
      en: "What individuals and small businesses can deduct in 2025 — a practical guide.",
      de: "Was Privatpersonen und Kleinunternehmen 2025 absetzen können — ein Praxisleitfaden.",
      vi: "Những gì cá nhân và doanh nghiệp nhỏ có thể khấu trừ năm 2025 — hướng dẫn thực tế.",
    },
    content: {
      en: `
        <p>Germany's tax code offers deductions for work-related expenses, home office, and more. This article explains major deductions, documentation tips, and examples for freelancers and small companies.</p>
        <h3>Key areas</h3>
        <ul>
          <li>Work-related expenses (Werbungskosten)</li>
          <li>Special expenses (Sonderausgaben)</li>
          <li>Business expenses (Betriebsausgaben)</li>
          <li>Home office rules and documentation</li>
        </ul>
      `,
      de: `
        <p>Das deutsche Steuerrecht ermöglicht Abzüge für Werbungskosten, Homeoffice und mehr. Dieser Artikel erklärt die wichtigsten Abzüge, Dokumentationstipps und Beispiele für Freiberufler und Kleinunternehmen.</p>
        <h3>Wesentliche Bereiche</h3>
        <ul>
          <li>Werbungskosten</li>
          <li>Sonderausgaben</li>
          <li>Betriebsausgaben</li>
          <li>Homeoffice-Regelungen und Belegaufbewahrung</li>
        </ul>
      `,
      vi: `
        <p>Mã thuế của Đức có nhiều khoản khấu trừ như chi phí liên quan công việc, làm việc tại nhà, v.v. Bài viết này giải thích các khoản chính, lưu ý về chứng từ và ví dụ cho freelancer và doanh nghiệp nhỏ.</p>
        <h3>Các mục chính</h3>
        <ul>
          <li>Chi phí liên quan công việc</li>
          <li>Chi phí đặc biệt</li>
          <li>Chi phí doanh nghiệp</li>
          <li>Quy định home office và lưu trữ hóa đơn</li>
        </ul>
      `,
    },
    coverImage: "https://images.unsplash.com/photo-1523289333742-bea4c7c0a2e6?auto=format&fit=crop&w=1400&q=80",
    tags: ["Taxes", "Freelancer", "Deductions"],
    author: { name: "Tax Consulting" },
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
      en: "Steps, registration, tax IDs and common pitfalls when starting a company in Germany.",
      de: "Schritte, Anmeldung, Steuernummern und häufige Fallstricke bei der Unternehmensgründung in Deutschland.",
      vi: "Các bước, đăng ký, mã số thuế và những rủi ro thường gặp khi thành lập công ty ở Đức.",
    },
    content: {
      en: `<p>Starting a business in Germany involves choosing a legal form, registering with the trade office, registering at the tax office, and often registering for VAT. This checklist walks through the most important steps and required documents.</p>`,
      de: `<p>Die Unternehmensgründung in Deutschland umfasst die Wahl der Rechtsform, Anmeldung beim Gewerbeamt, Registrierung beim Finanzamt und häufig die USt-Registrierung. Diese Checkliste führt durch die wichtigsten Schritte und Unterlagen.</p>`,
      vi: `<p>Thành lập doanh nghiệp ở Đức gồm chọn loại hình pháp lý, đăng ký kinh doanh, đăng ký tại cơ quan thuế và đăng ký VAT nếu cần. Checklist này hướng dẫn các bước chính và giấy tờ cần thiết.</p>`,
    },
    coverImage: "https://images.unsplash.com/photo-1498079022511-d15614cb1c02?auto=format&fit=crop&w=1400&q=80",
    tags: ["Business", "Startups", "Registration"],
    author: { name: "Tax Consulting" },
  },
  {
    id: "freelancer-tax-tips",
    date: "2025-03-02",
    title: {
      en: "Tax Tips for Freelancers in Germany",
      de: "Steuertipps für Freiberufler in Deutschland",
      vi: "Mẹo thuế cho Freelancer tại Đức",
    },
    excerpt: {
      en: "How freelancers can stay organized and reduce taxable income legally.",
      de: "Wie Freiberufler sich organisieren und legal ihr zu versteuerndes Einkommen reduzieren können.",
      vi: "Cách freelancers tổ chức và giảm thu nhập chịu thuế một cách hợp pháp.",
    },
    content: {
      en: `<p>Freelancers should track expenses, invoice correctly, set aside money for taxes and consider pension arrangements. We explain bookkeeping basics and helpful apps.</p>`,
      de: `<p>Freiberufler sollten Ausgaben dokumentieren, korrekt fakturieren, Rücklagen für Steuern bilden und Vorsorge prüfen. Wir erklären Buchhaltungsgrundlagen và nützliche Apps.</p>`,
      vi: `<p>Freelancer nên theo dõi chi phí, lập hóa đơn đúng, để dành tiền thuế và cân nhắc đóng bảo hiểm hưu trí. Bài viết trình bày cơ bản về kế toán và app hữu ích.</p>`,
    },
    coverImage: "https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?auto=format&fit=crop&w=1400&q=80",
    tags: ["Freelancer", "Bookkeeping", "Tips"],
    author: { name: "Tax Consulting" },
  },
];

export default blogPosts;
