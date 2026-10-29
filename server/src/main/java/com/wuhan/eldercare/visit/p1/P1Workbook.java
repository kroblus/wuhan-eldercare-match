package com.wuhan.eldercare.visit.p1;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.zip.*;

/** Standard OOXML XLSX, generated in the existing Java server without a separate export service.
 * All external strings are inlineStr cells. Only fixed internal ratio expressions are formulas. */
public final class P1Workbook {
    private static final String NS="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    private static final String REL="http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    private static final DateTimeFormatter BJ=DateTimeFormatter.ofPattern("uuuu-MM-dd HH:mm:ss").withZone(ZoneId.of("Asia/Shanghai"));
    private record Cell(String type,String value,int style,String formula){}
    private static final class Sheet {
        final String name;final TreeMap<Integer,TreeMap<Integer,Cell>> rows=new TreeMap<>();final Map<Integer,Integer> heights=new HashMap<>();final List<String> merges=new ArrayList<>();
        final double[] widths;int last=8;
        Sheet(String name,double...widths){this.name=name;this.widths=widths;}
        void text(int row,int col,String value,int style){cell(row,col,new Cell("inlineStr",value,style,null));}
        void number(int row,int col,long value){cell(row,col,new Cell("n",Long.toString(value),5,null));}
        void ratio(int row,int col,String formula,JsonNode value){cell(row,col,new Cell(value==null||value.isNull()?"str":"n",value==null||value.isNull()?"无可用比率":value.asText(),6,formula));}
        void cell(int row,int col,Cell cell){rows.computeIfAbsent(row,ignored->new TreeMap<>()).put(col,cell);last=Math.max(row,last);}
        void span(int row,int first,int end,String text,int style){
            text(row,first,text,style);
            for(int col=first+1;col<=end;col++)text(row,col,"",style);
            merges.add(ref(row,first)+":"+ref(row,end));
        }
        void height(int row,int points){heights.put(row,points);last=Math.max(last,row);}
        String sheetXml(boolean chart){
            var out=new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?><worksheet xmlns=\"").append(NS).append("\" xmlns:r=\"").append(REL).append("\">");
            out.append("<sheetPr><tabColor rgb=\"FF0F514F\"/><pageSetUpPr fitToPage=\"1\"/></sheetPr><dimension ref=\"A1:H").append(last).append("\"/><sheetViews><sheetView workbookViewId=\"0\" showGridLines=\"0\">");
            // A frozen pane cuts through the overview chart and merged report metadata.
            // Only scrolling detail sheets need a fixed header, never frozen columns.
            if(chart)out.append("<selection activeCell=\"A1\" sqref=\"A1\"/>");
            else out.append("<pane ySplit=\"8\" topLeftCell=\"A9\" activePane=\"bottomLeft\" state=\"frozen\"/><selection pane=\"bottomLeft\" activeCell=\"A9\" sqref=\"A9\"/>");
            out.append("</sheetView></sheetViews><sheetFormatPr defaultRowHeight=\"26\"/><cols>");
            for(int i=0;i<widths.length;i++)out.append("<col min=\"").append(i+1).append("\" max=\"").append(i+1).append("\" width=\"").append(widths[i]).append("\" customWidth=\"1\"/>");
            out.append("</cols><sheetData>");
            for(int row=1;row<=last;row++){
                out.append("<row r=\"").append(row).append("\" ht=\"").append(heights.getOrDefault(row,26)).append("\" customHeight=\"1\">");
                for(var entry:rows.getOrDefault(row,new TreeMap<>()).entrySet()){
                    var cell=entry.getValue();int style=cell.style();
                    // Light banding belongs only to data rows; title/section styles stay continuous.
                    if(row>8&&row%2==0)style=switch(style){case 0->8;case 2->9;case 5->10;default->style;};
                    if(style==0)style=11; // Bordered body cells must not be the workbook's default style.
                    out.append("<c r=\"").append(ref(row,entry.getKey())).append("\" s=\"").append(style).append("\" t=\"").append(cell.type()).append("\">");
                    if(cell.formula()!=null)out.append("<f>").append(xml(cell.formula())).append("</f>");
                    if(cell.type().equals("inlineStr"))out.append("<is><t xml:space=\"preserve\">").append(xml(cell.value())).append("</t></is>");else out.append("<v>").append(xml(cell.value())).append("</v>");out.append("</c>");
                }out.append("</row>");
            }out.append("</sheetData>");
            if(!merges.isEmpty()){out.append("<mergeCells count=\"").append(merges.size()).append("\">");for(String merge:merges)out.append("<mergeCell ref=\"").append(merge).append("\"/>");out.append("</mergeCells>");}
            out.append("<printOptions horizontalCentered=\"1\"/><pageMargins left=\"0.3\" right=\"0.3\" top=\"0.4\" bottom=\"0.4\" header=\"0.15\" footer=\"0.15\"/><pageSetup paperSize=\"9\" orientation=\"landscape\" fitToWidth=\"1\" fitToHeight=\"").append(chart?1:0).append("\"/>");
            out.append("<headerFooter><oddFooter>").append(xml("&L快康养 · 聚合服务报告&R第 &P / &N 页")).append("</oddFooter></headerFooter>");
            if(chart)out.append("<drawing r:id=\"rId1\"/>");return out.append("</worksheet>").toString();
        }
    }
    private static String ref(int row,int col){return String.valueOf((char)('A'+col-1))+row;}
    private static String xml(String value){return Objects.toString(value,"").replaceAll("[\\p{Cntrl}&&[^\\r\\n\\t]]","").replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;").replace("'","&apos;");}
    private static void metadata(Sheet s,JsonNode report){
        s.height(1,12);s.height(2,34);s.height(3,28);s.height(4,24);s.height(5,24);s.height(6,24);s.height(7,12);s.height(8,38);
        s.span(2,2,8,"快康养  "+s.name,1);s.span(3,2,8,report.path("warning").asText(),7);
        s.span(4,2,8,report.path("institutionName").asText()+"    "+report.path("from").asText()+" 至 "+report.path("to").asText()+"（含结束日）",2);
        s.span(5,2,8,"生成 / 观察截止："+BJ.format(Instant.parse(report.path("generatedAt").asText()))+" 北京时间    来源："+report.path("sourceFilter").asText(),2);
        s.span(6,2,8,"批次："+report.path("snapshotId").asText()+"    口径："+report.path("policyVersion").asText(),2);
    }
    public static byte[] create(JsonNode report){
        var summary=new Sheet("报告总览",3,36,18,15,15,15,15,15);
        var profile=new Sheet("需求画像汇总",3,24,30,16,16,16,16,16);
        var institutions=new Sheet("机构服务成果",3,30,16,16,16,16,16,18);
        var methodology=new Sheet("统计口径",3,14,22,22,22,22,22,22);
        var sheets=List.of(summary,profile,institutions,methodology);for(var s:sheets)metadata(s,report);
        var m=report.path("metrics");summary.text(8,2,"期间业务结果",3);summary.text(8,3,"数量",3);
        String[][] keys={{"newRequests","新需求（条）"},{"visitIntentRequests","关联带看意向（条）"},{"contactEvents","联系记录（次）"},{"connectedEvents","已接通（次）"},{"noAnswerEvents","未接通（次）"},{"refusedEvents","拒绝联系（次）"},{"confirmedSessions","首次双方确认（场）"},{"rescheduledEvents","改期（次）"},{"arrivedSessions","实际到访（场）"},{"arrivedRequests","期间到访去重需求（条）"},{"cancelledSessions","取消带看（场）"},{"noShowSessions","明确未到访（场）"}};
        int row=9;for(var key:keys){summary.text(row,2,key[1],0);summary.number(row,3,m.path(key[0]).asLong());summary.height(row++,26);}
        summary.height(21,8);summary.span(22,2,8,"同批需求转化 · 分母为本区间创建的关联需求，观察至生成时刻",4);summary.height(22,24);
        summary.text(23,2,"同批需求分母（条）",0);summary.number(23,3,m.path("cohortDenominator").asLong());summary.span(23,4,8,"期间到访可以来自旧需求；不能直接除以新需求",2);
        summary.text(24,2,"同批到访需求（条）",0);summary.number(24,3,m.path("cohortArrivedRequests").asLong());summary.span(24,4,8,"同批中的需求至少有一场明确到访才计入",2);
        summary.text(25,2,"同批到访率",4);summary.ratio(25,3,"IF(C23=0,\"无可用比率\",C24/C23)",m.path("cohortArrivalRate"));summary.span(25,4,8,"分母为0时无可用比率；不是期间活动相除",2);
        summary.text(26,2,"同批已接通需求（条）",0);summary.number(26,3,m.path("cohortContactedRequests").asLong());summary.span(26,4,8,"同批有来源入住反馈："+m.path("cohortMovedInRequests").asLong()+" 条（不代表签约）",2);
        summary.span(27,2,8,"平台总数按需求去重，不相加机构行；缺少访问埋点，不展示UV/PV。",2);summary.height(27,24);

        profile.text(8,2,"画像维度",3);profile.text(8,3,"分类",3);profile.text(8,4,"需求数（条）",3);profile.span(8,5,8,"来源 / 缺失与小样本处理",3);
        row=9;for(var p:report.path("profiles")){
            profile.text(row,2,p.path("dimension").asText(),0);profile.text(row,3,p.path("category").asText(),0);
            if(p.path("count").isNull())profile.text(row,4,"不展示",2);else profile.number(row,4,p.path("count").asLong());
            profile.span(row,5,8,p.path("note").asText(),2);profile.height(row++,44);
        }
        row++;profile.span(row++,2,8,"来源分开计数（同批需求，不混入真实获客）",4);
        for(var source:report.path("sources")){profile.span(row,2,3,sourceLabel(source.path("source").asText()),0);profile.number(row,4,source.path("count").asLong());profile.height(row++,26);}

        String[] headings={"机构","新需求\n条","带看意向\n条","期间确认\n场","期间到访\n场","到访需求\n去重条数","入住反馈\n有来源次数"};for(int col=2;col<=8;col++)institutions.text(8,col,headings[col-2],3);
        row=9;for(var institution:report.path("institutions")){
            var metric=institution.path("metrics");institutions.text(row,2,institution.path("institutionName").asText(),0);
            int col=3;for(String key:List.of("newRequests","visitIntentRequests","confirmedSessions","arrivedSessions","arrivedRequests","movedInFeedbackEvents"))institutions.number(row,col++,metric.path(key).asLong());institutions.height(row++,36);
        }
        if(row==9){institutions.span(row++,2,8,"该范围无机构关联需求，平台未定机构需求仅计入总览。",2);}
        row++;institutions.span(row++,2,8,"同批需求转化（各机构独立去重，不能相加）",4);int cohortHeader=row;
        String[] cohortHeadings={"机构","分母\n需求条数","同批接通\n需求条数","同批到访\n需求条数","同批入住反馈\n需求条数","同批到访率","观察截止"};for(int col=2;col<=8;col++)institutions.text(row,col,cohortHeadings[col-2],3);institutions.height(row++,38);
        for(var institution:report.path("institutions")){
            var metric=institution.path("metrics");institutions.text(row,2,institution.path("institutionName").asText(),0);
            institutions.number(row,3,metric.path("cohortDenominator").asLong());institutions.number(row,4,metric.path("cohortContactedRequests").asLong());institutions.number(row,5,metric.path("cohortArrivedRequests").asLong());institutions.number(row,6,metric.path("cohortMovedInRequests").asLong());
            institutions.ratio(row,7,"IF(C"+row+"=0,\"无可用比率\",E"+row+"/C"+row+")",metric.path("cohortArrivalRate"));institutions.text(row,8,"本批生成时刻",2);institutions.height(row++,36);
        }
        row++;institutions.span(row++,2,8,"关联需求的联系事件与机构专属看院分开；平台去重数见报告总览。",2);
        institutions.span(row,2,8,"尚未确定机构的需求可能只计入平台总览；不会将平台全部需求归给各机构。",2);institutions.height(row,32);
        row++;institutions.span(row,2,8,"本报告范围的期间后续反馈（仅有明确来源的记录）",4);institutions.height(row++,24);
        institutions.text(row,2,"已入住反馈（次）",0);institutions.number(row,3,m.path("movedInFeedbackEvents").asLong());institutions.text(row,4,"未入住反馈（次）",0);institutions.number(row,5,m.path("notMovedInFeedbackEvents").asLong());institutions.text(row,6,"未知反馈（次）",0);institutions.number(row,7,m.path("unknownFeedbackEvents").asLong());institutions.height(row++,36);
        institutions.span(row,2,8,"未收到反馈不等于未入住；仅记录服务结果，不代表签约、佣金或结算。",2);institutions.height(row,28);
        methodology.text(8,2,"序号",3);methodology.span(8,3,8,"统计规则与使用边界",3);
        row=9;for(var rule:report.path("rules")){methodology.number(row,2,row-8);methodology.span(row,3,8,rule.asText(),0);methodology.height(row++,36);}

        try(var bytes=new ByteArrayOutputStream();var zip=new ZipOutputStream(bytes,StandardCharsets.UTF_8)){
            put(zip,"[Content_Types].xml",contentTypes());
            put(zip,"_rels/.rels","<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\""+REL+"/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>");
            var workbook=new StringBuilder("<workbook xmlns=\"").append(NS).append("\" xmlns:r=\"").append(REL).append("\"><bookViews><workbookView activeTab=\"0\"/></bookViews><sheets>");
            var relationships=new StringBuilder("<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">");
            for(int i=0;i<sheets.size();i++){
                var sheet=sheets.get(i);workbook.append("<sheet name=\"").append(sheet.name).append("\" sheetId=\"").append(i+1).append("\" r:id=\"rId").append(i+1).append("\"/>");
                relationships.append("<Relationship Id=\"rId").append(i+1).append("\" Type=\"").append(REL).append("/worksheet\" Target=\"worksheets/sheet").append(i+1).append(".xml\"/>");put(zip,"xl/worksheets/sheet"+(i+1)+".xml",sheet.sheetXml(i==0));
            }
            workbook.append("</sheets><definedNames>");for(int i=0;i<sheets.size();i++){
                var sheet=sheets.get(i);workbook.append("<definedName name=\"_xlnm.Print_Area\" localSheetId=\"").append(i).append("\">'").append(sheet.name).append("'!$B$1:$H$").append(sheet.last).append("</definedName>");
                workbook.append("<definedName name=\"_xlnm.Print_Titles\" localSheetId=\"").append(i).append("\">'").append(sheet.name).append("'!$8:$8</definedName>");
            }workbook.append("</definedNames><calcPr calcId=\"191029\" fullCalcOnLoad=\"1\"/></workbook>");
            relationships.append("<Relationship Id=\"rId5\" Type=\"").append(REL).append("/styles\" Target=\"styles.xml\"/></Relationships>");
            put(zip,"xl/workbook.xml",workbook.toString());put(zip,"xl/_rels/workbook.xml.rels",relationships.toString());put(zip,"xl/styles.xml",styles());
            put(zip,"xl/worksheets/_rels/sheet1.xml.rels",rels("drawing","../drawings/drawing1.xml"));
            put(zip,"xl/drawings/_rels/drawing1.xml.rels",rels("chart","../charts/chart1.xml"));
            put(zip,"xl/drawings/drawing1.xml",drawing());put(zip,"xl/charts/chart1.xml",chart(m));zip.finish();return bytes.toByteArray();
        }catch(IOException e){throw new P1Failure(503,"EXPORT_UNAVAILABLE");}
    }
    private static String sourceLabel(String v){return switch(v){case "MINIPROGRAM"->"小程序主动申请";case "OFFLINE_MANUAL"->"线下人工来源";case "SELF_TEST"->"员工自测";case "SYNTHETIC_TEST_ONLY"->"合成测试";default->"来源未知";};}
    private static void put(ZipOutputStream zip,String name,String xml)throws IOException{var entry=new ZipEntry(name);entry.setTime(0);zip.putNextEntry(entry);zip.write(xml.getBytes(StandardCharsets.UTF_8));zip.closeEntry();}
    private static String rels(String type,String target){return "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\""+REL+"/"+type+"\" Target=\""+target+"\"/></Relationships>";}
    private static String contentTypes(){return "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/><Override PartName=\"/xl/worksheets/sheet2.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/><Override PartName=\"/xl/worksheets/sheet3.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/><Override PartName=\"/xl/worksheets/sheet4.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/><Override PartName=\"/xl/drawings/drawing1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.drawing+xml\"/><Override PartName=\"/xl/charts/chart1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.drawingml.chart+xml\"/></Types>";}
    private static String styles(){return """
      <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0"/><numFmt numFmtId="165" formatCode="0.0%"/></numFmts>
      <fonts count="5"><font><sz val="11"/><color rgb="FF213A36"/><name val="Microsoft YaHei"/></font><font><b/><sz val="17"/><color rgb="FF0F514F"/><name val="Microsoft YaHei"/></font><font><sz val="10"/><color rgb="FF61736F"/><name val="Microsoft YaHei"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Microsoft YaHei"/></font><font><b/><sz val="11"/><color rgb="FF176C65"/><name val="Microsoft YaHei"/></font></fonts>
      <fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F514F"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7F5EE"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF7FBF8"/><bgColor indexed="64"/></patternFill></fill></fills>
      <borders count="4"><border/><border><bottom style="thin"><color rgb="FFE4EEE8"/></bottom></border><border><bottom style="thin"><color rgb="FF34A48A"/></bottom></border><border><right style="thin"><color rgb="FFFFFFFF"/></right></border></borders>
      <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
      <cellXfs count="12">
      <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
      <xf numFmtId="0" fontId="1" fillId="0" borderId="2" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
      <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1" indent="1"/></xf>
      <xf numFmtId="0" fontId="3" fillId="2" borderId="3" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
      <xf numFmtId="0" fontId="4" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1" indent="1"/></xf>
      <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" indent="1" vertical="center"/></xf>
      <xf numFmtId="165" fontId="4" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" indent="1" vertical="center" wrapText="1"/></xf>
      <xf numFmtId="0" fontId="4" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1" indent="1"/></xf>
      <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1" indent="1"/></xf>
      <xf numFmtId="0" fontId="2" fillId="4" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1" indent="1"/></xf>
      <xf numFmtId="164" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" indent="1" vertical="center"/></xf>
      <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1" indent="1"/></xf>
      </cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>
      """;}
    private static String drawing(){return """
      <xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:oneCellAnchor><xdr:from><xdr:col>3</xdr:col><xdr:colOff>140000</xdr:colOff><xdr:row>7</xdr:row><xdr:rowOff>100000</xdr:rowOff></xdr:from><xdr:ext cx="5905500" cy="4095750"/><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="期间联系结果"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>
      """;}
    private static String chart(JsonNode m){
        var cache=new StringBuilder();String[] keys={"connectedEvents","noAnswerEvents","refusedEvents"};for(int i=0;i<3;i++)cache.append("<c:pt idx=\"").append(i).append("\"><c:v>").append(m.path(keys[i]).asLong()).append("</c:v></c:pt>");
        return """
        <c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:lang val="zh-CN"/><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="zh-CN" sz="1200"><a:solidFill><a:srgbClr val="0F514F"/></a:solidFill><a:latin typeface="Microsoft YaHei"/><a:ea typeface="Microsoft YaHei"/></a:rPr><a:t>期间联系结果（次）</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>实际联系记录</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="34A48A"/></a:solidFill></c:spPr><c:cat><c:strRef><c:f>'报告总览'!$B$12:$B$14</c:f><c:strCache><c:ptCount val="3"/><c:pt idx="0"><c:v>已接通</c:v></c:pt><c:pt idx="1"><c:v>未接通</c:v></c:pt><c:pt idx="2"><c:v>拒绝联系</c:v></c:pt></c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>'报告总览'!$C$12:$C$14</c:f><c:numCache><c:formatCode>0</c:formatCode><c:ptCount val="3"/>
        """+cache+"""
        </c:numCache></c:numRef></c:val></c:ser><c:gapWidth val="110"/><c:axId val="1"/><c:axId val="2"/></c:barChart><c:catAx><c:axId val="1"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="2"/><c:crosses val="autoZero"/></c:catAx><c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines><c:spPr><a:ln><a:solidFill><a:srgbClr val="E4EEE8"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="0" sourceLinked="0"/><c:tickLblPos val="nextTo"/><c:crossAx val="1"/><c:crosses val="autoZero"/><c:crossBetween val="between"/><c:majorUnit val="1"/></c:valAx></c:plotArea><c:plotVisOnly val="1"/></c:chart></c:chartSpace>
        """;
    }
}
