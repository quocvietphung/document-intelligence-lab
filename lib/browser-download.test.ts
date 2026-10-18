import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {downloadBlob,downloadJson} from "./browser-download";

describe("browser downloads",()=>{
  const click=vi.fn(),createObjectURL=vi.fn(),revokeObjectURL=vi.fn();
  let link:{href:string;download:string;click:typeof click};

  beforeEach(()=>{
    vi.useFakeTimers();
    click.mockReset();
    createObjectURL.mockReset().mockReturnValue("blob:private-test");
    revokeObjectURL.mockReset();
    link={href:"",download:"",click};
    vi.stubGlobal("document",{createElement:vi.fn(()=>link)});
    vi.spyOn(URL,"createObjectURL").mockImplementation(createObjectURL);
    vi.spyOn(URL,"revokeObjectURL").mockImplementation(revokeObjectURL);
  });

  afterEach(()=>{
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps the original blob, filename and MIME type",()=>{
    const blob=new Blob(["private document"],{type:"application/pdf"});
    downloadBlob(blob,"source.pdf");
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(link).toMatchObject({href:"blob:private-test",download:"source.pdf"});
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:private-test");
  });

  it("releases the object URL even when the browser rejects the download",()=>{
    click.mockImplementation(()=>{throw new Error("Download blocked");});
    expect(()=>downloadBlob(new Blob(),"blocked.json")).toThrow("Download blocked");
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:private-test");
  });

  it("exports readable JSON without mutating evidence",async()=>{
    const value={amount:"1.250,50 EUR",source:"doc-1:p1"};
    downloadJson(value,"evidence.json");
    const blob=createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/json");
    expect(await blob.text()).toBe(JSON.stringify(value,null,2));
    expect(value.amount).toBe("1.250,50 EUR");
    expect(link.download).toBe("evidence.json");
  });
});
