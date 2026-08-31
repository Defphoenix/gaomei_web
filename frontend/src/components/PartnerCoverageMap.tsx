import React, { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";

type Site = {
  name: string;
  value: [number, number];
  hub?: boolean;
  province: string;
  desc?: string;
};

type ProvinceInfo = {
  name: string;
  capital: string;
  hospitals: string[];
  nurseStations: string[];
  summary: string;
};

const HUB: Site = {
  name: "杭州总部",
  value: [120.15, 30.28],
  hub: true,
  province: "浙江省",
  desc: "浙江高美基因科技有限公司",
};

const SITES: Site[] = [
  HUB,
  { name: "嘉善网点", value: [120.92, 30.84], province: "浙江省", desc: "浙江嘉善合作网点" },
  { name: "邵逸夫医院", value: [120.19, 30.26], province: "浙江省", desc: "浙大医学院附属邵逸夫医院" },
  { name: "杭州市一", value: [120.17, 30.25], province: "浙江省", desc: "杭州市第一人民医院" },
  { name: "浙大二院", value: [120.16, 30.26], province: "浙江省", desc: "浙江大学医学院附属第二医院" },
  { name: "南京", value: [118.78, 32.06], province: "江苏省", desc: "江苏合作网点" },
  { name: "苏州附一院", value: [120.62, 31.32], province: "江苏省", desc: "苏州大学附属第一医院" },
  { name: "宜兴市人民医院", value: [119.82, 31.34], province: "江苏省", desc: "宜兴市人民医院" },
  { name: "中山医院", value: [121.45, 31.22], province: "上海市", desc: "复旦大学附属中山医院" },
  { name: "新华医院", value: [121.52, 31.27], province: "上海市", desc: "上海交大医学院附属新华医院" },
  { name: "广州研发", value: [113.26, 23.13], province: "广东省", desc: "广州研发基地" },
  { name: "广医一院", value: [113.27, 23.14], province: "广东省", desc: "广州医科大学附属第一医院" },
  { name: "广医三院", value: [113.28, 23.10], province: "广东省", desc: "广州医科大学附属第三医院" },
  { name: "青岛大学附属医院", value: [120.38, 36.07], province: "山东省", desc: "青岛大学附属医院" },
  { name: "济南网点", value: [117.00, 36.65], province: "山东省", desc: "山东合作网点" },
  { name: "华西医院", value: [104.06, 30.67], province: "四川省", desc: "四川大学华西医院" },
  { name: "天津肿瘤医院", value: [117.20, 39.08], province: "天津市", desc: "天津市肿瘤医院" },
  { name: "北京网点", value: [116.40, 39.90], province: "北京市", desc: "华北合作网点" },
  { name: "哈尔滨", value: [126.53, 45.80], province: "黑龙江省", desc: "黑龙江合作网点" },
  { name: "西安", value: [108.93, 34.27], province: "陕西省", desc: "陕西合作网点" },
  { name: "武汉", value: [114.30, 30.59], province: "湖北省", desc: "湖北合作网点" },
  { name: "郑州", value: [113.62, 34.75], province: "河南省", desc: "河南合作网点" },
  { name: "合肥", value: [117.25, 31.82], province: "安徽省", desc: "安徽合作网点" },
  { name: "南昌", value: [115.85, 28.68], province: "江西省", desc: "江西合作网点" },
  { name: "石家庄", value: [114.48, 38.03], province: "河北省", desc: "河北合作网点" },
];

const PROVINCE_INFO: Record<string, ProvinceInfo> = {
  浙江省: {
    name: "浙江省",
    capital: "杭州",
    hospitals: ["浙江大学医学院附属邵逸夫医院", "杭州市第一人民医院", "浙江大学医学院附属第二医院", "嘉善区域合作医院"],
    nurseStations: ["杭州总部护理服务站", "邵逸夫医院样本采血护理点", "嘉善健康管理护理站"],
    summary: "杭州为全国枢纽总部所在地，覆盖严肃医疗与健康管理双通道服务。",
  },
  江苏省: {
    name: "江苏省",
    capital: "南京",
    hospitals: ["苏州大学附属第一医院", "宜兴市人民医院", "南京区域协作医院"],
    nurseStations: ["南京采血护理站", "苏州随访护理点", "宜兴社区护理服务站"],
    summary: "以南京、苏州为核心，联动苏南三甲与县域医疗机构。",
  },
  上海市: {
    name: "上海市",
    capital: "上海",
    hospitals: ["复旦大学附属中山医院", "上海交通大学医学院附属新华医院"],
    nurseStations: ["中山医院协作护理点", "新华医院样本护理站"],
    summary: "依托上海顶尖三甲，开展科研协作与临床样本服务。",
  },
  广东省: {
    name: "广东省",
    capital: "广州",
    hospitals: ["广州医科大学附属第一医院", "广州医科大学附属第三医院", "广州研发协作中心"],
    nurseStations: ["广州研发基地护理站", "广医一院采血护理点", "广医三院随访护理点"],
    summary: "广州研发基地辐射华南，支撑南方区域早筛落地。",
  },
  山东省: {
    name: "山东省",
    capital: "济南",
    hospitals: ["青岛大学附属医院", "济南区域协作医院"],
    nurseStations: ["青岛样本护理站", "济南健康管理护理点"],
    summary: "覆盖胶东与省会双核，服务沿海高危人群筛查。",
  },
  四川省: {
    name: "四川省",
    capital: "成都",
    hospitals: ["四川大学华西医院"],
    nurseStations: ["华西协作护理站", "成都健康管理护理点"],
    summary: "以华西医院为支点，拓展西南严肃医疗网络。",
  },
  天津市: {
    name: "天津市",
    capital: "天津",
    hospitals: ["天津市肿瘤医院"],
    nurseStations: ["天津肿瘤医院护理协作点"],
    summary: "聚焦肿瘤专科协作，服务京津冀早筛需求。",
  },
  北京市: {
    name: "北京市",
    capital: "北京",
    hospitals: ["北京区域协作医疗机构"],
    nurseStations: ["北京健康管理护理站"],
    summary: "华北枢纽节点，承接首都圈合作与学术交流。",
  },
  黑龙江省: {
    name: "黑龙江省",
    capital: "哈尔滨",
    hospitals: ["哈尔滨区域协作医院"],
    nurseStations: ["哈尔滨采血护理站"],
    summary: "东北合作网点，持续拓展高寒地区服务能力。",
  },
  陕西省: {
    name: "陕西省",
    capital: "西安",
    hospitals: ["西安区域协作医院"],
    nurseStations: ["西安护理服务站"],
    summary: "西北关键节点，连接关中城市群合作网络。",
  },
  湖北省: {
    name: "湖北省",
    capital: "武汉",
    hospitals: ["武汉区域协作医院"],
    nurseStations: ["武汉采血护理站"],
    summary: "华中协作节点，服务长江中游城市群。",
  },
  河南省: {
    name: "河南省",
    capital: "郑州",
    hospitals: ["郑州区域协作医院"],
    nurseStations: ["郑州健康管理护理点"],
    summary: "中原腹地合作网点，覆盖高人口密度筛查需求。",
  },
  安徽省: {
    name: "安徽省",
    capital: "合肥",
    hospitals: ["合肥区域协作医院"],
    nurseStations: ["合肥护理服务站"],
    summary: "长三角西翼节点，联动江浙沪服务网络。",
  },
  江西省: {
    name: "江西省",
    capital: "南昌",
    hospitals: ["南昌区域协作医院"],
    nurseStations: ["南昌采血护理站"],
    summary: "华东内陆合作网点，持续拓展中部覆盖。",
  },
  河北省: {
    name: "河北省",
    capital: "石家庄",
    hospitals: ["石家庄区域协作医院"],
    nurseStations: ["石家庄护理服务站"],
    summary: "京津冀协同节点，服务环首都医疗网络。",
  },
};

const DEFAULT_PANEL: ProvinceInfo = {
  name: "全国网络",
  capital: "杭州（总部）",
  hospitals: ["严肃医疗——全国 37 家三甲医院", "健康管理与民营医院合作机构数十家"],
  nurseStations: ["总部标准化采血护理流程", "合作医院内设样本护理点", "健康管理机构随访护理站"],
  summary: "以杭州总部为枢纽，合作网点持续拓展。悬停左侧省份，可查看该省合作站点与护理站。",
};

const ACTIVE_PROVINCES = Object.keys(PROVINCE_INFO);

const PartnerCoverageMap: React.FC = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<ProvinceInfo>(DEFAULT_PANEL);
  const [activeProvince, setActiveProvince] = useState<string | null>(null);

  const nodes = useMemo(() => SITES.filter((s) => !s.hub), []);
  const lines = useMemo(
    () =>
      nodes.map((site) => ({
        fromName: site.name,
        toName: HUB.name,
        coords: [site.value, HUB.value] as [[number, number], [number, number]],
      })),
    [nodes],
  );

  useEffect(() => {
    let disposed = false;
    let ro: ResizeObserver | null = null;

    async function boot() {
      try {
        const res = await fetch("/assets/geo/china.json");
        if (!res.ok) throw new Error("地图数据加载失败");
        const geo = await res.json();
        if (disposed || !hostRef.current) return;

        echarts.registerMap("china", geo as never);
        const chart = echarts.init(hostRef.current, undefined, { renderer: "canvas" });
        chartRef.current = chart;

        chart.setOption({
          backgroundColor: "transparent",
          tooltip: {
            trigger: "item",
            backgroundColor: "rgba(6,16,36,.94)",
            borderColor: "rgba(99,154,255,.45)",
            borderWidth: 1,
            padding: [12, 14],
            textStyle: { color: "#e8f1ff", fontSize: 12 },
            formatter: (params: {
              componentType?: string;
              seriesType?: string;
              name?: string;
              data?: { name?: string; desc?: string; hub?: boolean; province?: string };
            }) => {
              if (params.seriesType === "lines") return "";
              if (params.componentType === "geo") {
                const info = params.name ? PROVINCE_INFO[params.name] : undefined;
                if (!info) return `${params.name || ""}`;
                return `<div style="font-weight:800;font-size:13px;margin-bottom:6px">${info.name}</div>
                  <div style="color:#8eb6ff;margin-bottom:6px">省会：${info.capital}</div>
                  <div style="color:#b7c7de;max-width:240px;line-height:1.55">${info.summary}</div>`;
              }
              const data = params.data;
              if (!data?.name) return params.name || "";
              return `<div style="font-weight:700">${data.name}</div>
                <div style="color:#8eb6ff;font-size:11px;margin-top:4px">${data.hub ? "总部枢纽" : "合作网点"}</div>
                ${data.desc ? `<div style="margin-top:6px;color:#b7c7de;font-size:11px">${data.desc}</div>` : ""}`;
            },
          },
          geo: {
            map: "china",
            roam: false,
            zoom: 1.22,
            center: [105.2, 35.5],
            aspectScale: 0.85,
            layoutCenter: ["48%", "52%"],
            layoutSize: "108%",
            label: { show: false },
            itemStyle: {
              areaColor: "#0a2348",
              borderColor: "rgba(100,160,230,.35)",
              borderWidth: 0.8,
              shadowColor: "rgba(40,120,255,.28)",
              shadowBlur: 24,
            },
            emphasis: {
              itemStyle: {
                areaColor: "#1f6ad0",
                borderColor: "#9fd0ff",
                borderWidth: 1.4,
                shadowBlur: 30,
                shadowColor: "rgba(90,180,255,.55)",
              },
              label: {
                show: true,
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
              },
            },
            select: { disabled: true },
            regions: [
              ...ACTIVE_PROVINCES.map((name) => ({
                name,
                itemStyle: {
                  areaColor: "#143f78",
                  borderColor: "rgba(140,200,255,.5)",
                },
                emphasis: {
                  itemStyle: {
                    areaColor: "#2a7ef0",
                    borderColor: "#b8deff",
                  },
                },
              })),
              { name: "南海诸岛", itemStyle: { areaColor: "#0a2348", borderColor: "rgba(100,160,230,.3)" } },
            ],
          },
          series: [
            {
              name: "飞线",
              type: "lines",
              coordinateSystem: "geo",
              zlevel: 2,
              effect: {
                show: true,
                period: 4.2,
                trailLength: 0.5,
                symbol: "arrow",
                symbolSize: 5,
                color: "#7ad2ff",
              },
              lineStyle: {
                color: "rgba(100,180,255,.38)",
                width: 1.1,
                opacity: 0.6,
                curveness: 0.25,
              },
              data: lines,
              silent: true,
            },
            {
              name: "合作网点",
              type: "effectScatter",
              coordinateSystem: "geo",
              zlevel: 3,
              rippleEffect: { brushType: "stroke", scale: 3.4, period: 3.2 },
              symbolSize: 8,
              itemStyle: {
                color: "#ff5a4d",
                shadowBlur: 14,
                shadowColor: "rgba(255,80,60,.7)",
              },
              label: { show: false },
              emphasis: {
                scale: 1.4,
                label: {
                  show: true,
                  formatter: "{b}",
                  position: "top",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  backgroundColor: "rgba(8,20,45,.88)",
                  padding: [4, 7],
                  borderRadius: 6,
                },
              },
              data: nodes.map((s) => ({
                name: s.name,
                value: [...s.value, 1],
                desc: s.desc,
                province: s.province,
                hub: false,
              })),
            },
            {
              name: "杭州总部",
              type: "effectScatter",
              coordinateSystem: "geo",
              zlevel: 4,
              rippleEffect: { brushType: "stroke", scale: 4.8, period: 2.6 },
              symbolSize: 15,
              itemStyle: {
                color: "#4db7ff",
                shadowBlur: 26,
                shadowColor: "rgba(77,183,255,.9)",
              },
              label: {
                show: true,
                formatter: "{b}",
                position: "right",
                color: "#eaf5ff",
                fontSize: 13,
                fontWeight: 800,
                distance: 10,
              },
              data: [{
                name: HUB.name,
                value: [...HUB.value, 1],
                desc: HUB.desc,
                province: HUB.province,
                hub: true,
              }],
            },
          ],
        });

        chart.on("mouseover", (params) => {
          const name = params.name;
          if (!name) return;
          if (params.componentType === "geo") {
            const info = PROVINCE_INFO[name];
            if (info) {
              setActiveProvince(name);
              setPanel(info);
            } else {
              setActiveProvince(null);
              setPanel({
                ...DEFAULT_PANEL,
                name: name,
                capital: "—",
                summary: `${name}暂未配置详细合作站点信息，全国合作网点持续拓展中。`,
                hospitals: ["协作拓展中"],
                nurseStations: ["护理站规划中"],
              });
            }
            return;
          }
          if (params.data && typeof params.data === "object" && "province" in (params.data as object)) {
            const province = (params.data as { province?: string }).province;
            if (province && PROVINCE_INFO[province]) {
              setActiveProvince(province);
              setPanel(PROVINCE_INFO[province]);
            }
          }
        });

        chart.on("globalout", () => {
          setActiveProvince(null);
          setPanel(DEFAULT_PANEL);
        });

        ro = new ResizeObserver(() => chart.resize());
        ro.observe(hostRef.current);
        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "地图初始化失败");
      }
    }

    boot();
    return () => {
      disposed = true;
      ro?.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, [lines, nodes]);

  return (
    <section className="section coverage-section">
      <div className="coverage-glow" />
      <div className="site-container coverage-split">
        <div className="coverage-map-pane motion-reveal">
          <div className="coverage-chart-host" ref={hostRef} />
          {!ready && !error && <div className="coverage-chart-loading">地图加载中…</div>}
          {error && <div className="coverage-chart-loading">{error}</div>}
          <div className="coverage-mini-legend">
            <span className="leg-hub"><i /> 杭州总部</span>
            <span className="leg-node"><i /> 合作网点</span>
            <span className="leg-line"><i /> 汇聚飞线</span>
          </div>
        </div>

        <aside className={`coverage-side-pane motion-reveal ${activeProvince ? "is-active" : ""}`}>
          <div className="coverage-side-head">
            <span className="eyebrow">NATIONAL NETWORK</span>
            <h2>全国合作网点</h2>
            <p className="coverage-lead">
              以杭州总部为中枢，严肃医疗与健康管理双通道协同。悬停左侧省份，查看省会医疗合作站点与护理站介绍。
            </p>
          </div>

          <div className="coverage-detail-stack">
            <div className="coverage-province-card">
              <small>当前区域</small>
              <strong>{panel.name}</strong>
              <em>省会 / 枢纽：{panel.capital}</em>
              <p>{panel.summary}</p>
            </div>

            <div className="coverage-info-block">
              <h3><i className="fas fa-hospital" /> 医疗合作站点</h3>
              <ul>
                {panel.hospitals.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="coverage-info-block">
              <h3><i className="fas fa-user-nurse" /> 护理站介绍</h3>
              <ul>
                {panel.nurseStations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="coverage-side-stats">
            <div><b>37+</b><span>三甲医院</span></div>
            <div><b>数十家</b><span>健康管理机构</span></div>
            <div><b>{ACTIVE_PROVINCES.length}</b><span>已合作省份</span></div>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default PartnerCoverageMap;
