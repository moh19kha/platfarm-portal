// @ts-nocheck
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { CreateOdooShipment } from "@/components/CreateOdooShipment";
import { CreateProductionOrder, type PressingData } from "@/components/CreateProductionOrder";
import { NewTransferWizard } from "@/components/NewTransferWizard";
import { PlatfarmLogo } from "@/components/PlatfarmLogo";
import IncomingShipments from "./IncomingShipments";
import PressingShifts from "./PressingShifts";


// Custom icon images (matching mobile app)
const ICON_PROCUREMENT = "https://d2xsxph8kpxj0f.cloudfront.net/310519663129724353/X5tJK2uaPFqt5EwqucHsfz/procurement-plant_98451ba2.png";
const ICON_TRANSFER = "https://d2xsxph8kpxj0f.cloudfront.net/310519663129724353/X5tJK2uaPFqt5EwqucHsfz/transfer-truck_55a83f8d.png";
const ICON_PRESSING = "https://d2xsxph8kpxj0f.cloudfront.net/310519663129724353/X5tJK2uaPFqt5EwqucHsfz/pressing-machine_7624d931.png";
const ImgIcon = ({src,size=15}:{src:string;size?:number}) => <img src={src} alt="" style={{width:size,height:size,objectFit:"contain"}} />;

const fK=(kg)=>{if(Math.abs(kg)>=1000)return(kg/1000).toFixed(1)+"t";return Math.round(kg).toLocaleString()+" kg";};

// Sync statuses
const SY={synced:{bg:"#E4EFE6",c:"#2D5A3D",l:"✓ Synced"},pending:{bg:"#FDF6EC",c:"#D4960A",l:"⏳ Pending"},error:{bg:"#FDF0F0",c:"#C94444",l:"⚠ Error"},processing:{bg:"#F2F7F3",c:"#4A7C59",l:"⟳ Processing"}};

// Fallback empty arrays (used while loading or on error)
const EMPTY_RCV=[];
const EMPTY_QC=[];
const EMPTY_DPR=[];
const EMPTY_TRF=[];

// Legacy hardcoded data kept as fallback reference
const RCV=[
  {id:"RCV-0043",supplier:"Al-Wataniya",commodity:"Alfalfa",grade:"Premium",site:"Ain Sokhna",plate:"ق ص م 7231",stage:"qc_done",qcRef:"QC-0028",driver:"Ahmed Ibrahim",gross:28400,tare:8200,net:20200,bales:52,avgBale:388,price:4200,currency:"EGP",incoterm:"Farm Gate",truckInc:"No",truckPayer:"Platfarm",truckCost:2500,date:"11 Mar 2026",time:"10:32",sync:"synced",baleSize:"Large",notes:"",att:[{n:"Weighbridge Ticket",t:"photo",s:"✓"},{n:"Truck / Plate",t:"photo",s:"✓"},{n:"Supply Contract",t:"doc",s:"✓"},{n:"Driver License",t:"doc",s:"✓"},{n:"Driver ID",t:"doc",s:"✓"},{n:"Right Side",t:"photo",s:"✓"}]},
  {id:"RCV-0042",supplier:"Al-Wataniya",commodity:"Alfalfa",grade:"G1",site:"Ain Sokhna",plate:"ق ص م 7231",stage:"qc_done",qcRef:"QC-0027",driver:"Ahmed Ibrahim",gross:26800,tare:8200,net:18600,bales:48,avgBale:387,price:3800,currency:"EGP",incoterm:"Farm Gate",truckInc:"No",truckPayer:"Platfarm",truckCost:2500,date:"10 Mar 2026",time:"09:15",sync:"synced",baleSize:"Large",notes:"",att:[{n:"Weighbridge Ticket",t:"photo",s:"✓"},{n:"Truck / Plate",t:"photo",s:"✓"},{n:"Supply Contract",t:"doc",s:"✓"},{n:"Driver License",t:"doc",s:"✓"},{n:"Driver ID",t:"doc",s:"✓"},{n:"Right Side",t:"photo",s:"✓"},{n:"Left Side",t:"photo",s:"✓"},{n:"Rear Load",t:"photo",s:"✓"}]},
  {id:"RCV-0041",supplier:"Delta Agri",commodity:"Rhodes Grass",grade:"G1",site:"Dakhla",plate:"ن ع ب 3912",stage:"qc_done",qcRef:"QC-0026",driver:"Mahmoud Ota",gross:22100,tare:7400,net:14700,bales:38,avgBale:386,price:3200,currency:"EGP",incoterm:"Factory",truckInc:"Yes",truckPayer:"—",truckCost:0,date:"09 Mar 2026",time:"08:15",sync:"pending",baleSize:"Large",notes:"Slight delay at weighbridge",att:[{n:"Weighbridge Ticket",t:"photo",s:"✓"},{n:"Truck / Plate",t:"photo",s:"✓"},{n:"Supply Contract",t:"doc",s:"✓"},{n:"Right Side",t:"photo",s:"✓"},{n:"Left Side",t:"photo",s:"✓"}]},
  {id:"RCV-0040",supplier:"Nile Valley Farms",commodity:"Alfalfa",grade:"Standard",site:"Ain Sokhna",plate:"ج م ط 4521",stage:"qc_done",qcRef:"QC-0023",driver:"Essam Edris",gross:31200,tare:8800,net:22400,bales:95,avgBale:235,price:2800,currency:"EGP",incoterm:"Farm Gate",truckInc:"No",truckPayer:"Supplier",truckCost:3200,date:"08 Mar 2026",time:"11:45",sync:"synced",baleSize:"Small",notes:"",att:[{n:"Weighbridge Ticket",t:"photo",s:"✓"},{n:"Truck / Plate",t:"photo",s:"✓"},{n:"Supply Contract",t:"doc",s:"✓"},{n:"Driver License",t:"doc",s:"✓"},{n:"Driver ID",t:"doc",s:"✓"},{n:"Right Side",t:"photo",s:"✓"},{n:"Left Side",t:"photo",s:"✓"},{n:"Rear Load",t:"photo",s:"✓"}]},
  {id:"RCV-0039",supplier:"Al-Wataniya",commodity:"WheatStraw",grade:"Standard",site:"Ain Sokhna",plate:"ق ص م 7231",stage:"received",qcRef:"",driver:"Ahmed Ibrahim",gross:19800,tare:8200,net:11600,bales:42,avgBale:276,price:1500,currency:"EGP",incoterm:"Farm Gate",truckInc:"Yes",truckPayer:"—",truckCost:0,date:"07 Mar 2026",time:"14:20",sync:"synced",baleSize:"Small",notes:"",att:[{n:"Weighbridge Ticket",t:"photo",s:"✓"},{n:"Truck / Plate",t:"photo",s:"✓"},{n:"Supply Contract",t:"doc",s:"✓"},{n:"Right Side",t:"photo",s:"✓"},{n:"Left Side",t:"photo",s:"✓"},{n:"Rear Load",t:"photo",s:"✓"},{n:"Driver License",t:"doc",s:"✓"}]},
  {id:"RCV-0038",supplier:"Upper Egypt Co-op",commodity:"Alfalfa",grade:"G1",site:"Dakhla",plate:"ص ع د 2810",stage:"shipped",qcRef:"",driver:"Fadl El Mola",gross:25600,tare:7800,net:17800,bales:46,avgBale:387,price:3600,currency:"EGP",incoterm:"Factory",truckInc:"No",truckPayer:"Platfarm",truckCost:4500,date:"06 Mar 2026",time:"07:30",sync:"error",baleSize:"Large",notes:"Weighbridge photo missing",att:[{n:"Truck / Plate",t:"photo",s:"✓"},{n:"Supply Contract",t:"doc",s:"✓"},{n:"Right Side",t:"photo",s:"✓"},{n:"Weighbridge Ticket",t:"photo",s:"✗"}]},
  {id:"RCV-0037",supplier:"Delta Agri",commodity:"Rhodes Grass",grade:"Standard",site:"Ain Sokhna",plate:"ن ع ب 3912",stage:"qc_done",qcRef:"",driver:"Mahmoud Ota",gross:20400,tare:7400,net:13000,bales:35,avgBale:371,price:2600,currency:"EGP",incoterm:"Factory",truckInc:"Yes",truckPayer:"—",truckCost:0,date:"05 Mar 2026",time:"10:00",sync:"synced",baleSize:"Large",notes:"",att:[{n:"Weighbridge Ticket",t:"photo",s:"✓"},{n:"Truck / Plate",t:"photo",s:"✓"},{n:"Supply Contract",t:"doc",s:"✓"},{n:"Driver License",t:"doc",s:"✓"},{n:"Driver ID",t:"doc",s:"✓"},{n:"Right Side",t:"photo",s:"✓"},{n:"Left Side",t:"photo",s:"✓"},{n:"Rear Load",t:"photo",s:"✓"}]},
  {id:"RCV-0036",supplier:"Upper Egypt Co-op",commodity:"Alfalfa",grade:"G1",site:"Dakhla",plate:"ص ع د 2810",stage:"qc_done",qcRef:"",driver:"Fadl El Mola",gross:27200,tare:7800,net:19400,bales:50,avgBale:388,price:3600,currency:"EGP",incoterm:"Factory",truckInc:"No",truckPayer:"Platfarm",truckCost:4500,date:"25 Feb 2026",time:"08:00",sync:"synced",baleSize:"Large",notes:"",att:[{n:"Weighbridge Ticket",t:"photo",s:"✓"},{n:"Truck / Plate",t:"photo",s:"✓"},{n:"Supply Contract",t:"doc",s:"✓"},{n:"Right Side",t:"photo",s:"✓"},{n:"Rear Load",t:"photo",s:"✓"}]},
  {id:"RCV-0035",supplier:"Nile Valley Farms",commodity:"Alfalfa",grade:"Premium",site:"Ain Sokhna",plate:"ج م ط 4521",stage:"qc_done",qcRef:"",driver:"Essam Edris",gross:29800,tare:8800,net:21000,bales:54,avgBale:389,price:4200,currency:"EGP",incoterm:"Farm Gate",truckInc:"No",truckPayer:"Supplier",truckCost:3000,date:"18 Feb 2026",time:"09:30",sync:"synced",baleSize:"Large",notes:"",att:[{n:"Weighbridge Ticket",t:"photo",s:"✓"},{n:"Truck / Plate",t:"photo",s:"✓"},{n:"Supply Contract",t:"doc",s:"✓"},{n:"Driver License",t:"doc",s:"✓"},{n:"Right Side",t:"photo",s:"✓"},{n:"Left Side",t:"photo",s:"✓"}]},
  {id:"RCV-0034",supplier:"Delta Agri",commodity:"Rhodes Grass",grade:"G1",site:"Dakhla",plate:"ن ع ب 3912",stage:"qc_done",qcRef:"",driver:"Mahmoud Ota",gross:21600,tare:7400,net:14200,bales:37,avgBale:384,price:3200,currency:"EGP",incoterm:"Factory",truckInc:"Yes",truckPayer:"—",truckCost:0,date:"02 Feb 2026",time:"11:00",sync:"synced",baleSize:"Large",notes:"",att:[{n:"Weighbridge Ticket",t:"photo",s:"✓"},{n:"Truck / Plate",t:"photo",s:"✓"},{n:"Supply Contract",t:"doc",s:"✓"},{n:"Right Side",t:"photo",s:"✓"}]},
];

// Quality assessments
const QC=[
  // Purchase QC — raw material from supplier
  {id:"QC-0028",type:"received",ref:"RCV-0043",supplier:"Al-Wataniya",commodity:"Alfalfa",grade:"Premium",site:"Ain Sokhna",inspector:"Adam Mohamed",bales:52,netWeight:20200,
   color:"Dark Green",leafRatio:"85%",foreignMatter:"1.2%",odor:"Fresh",moisture:"11.8%",moistureWeight:"3%",protein:"18.2%",density:"High",avgWeight:"388",baleHeight:"42",
   truckClean:"Yes",hasCover:"Yes",strapGood:"Yes",stackGood:"Yes",noWeeds:"Yes",baleTies:"Good",baleShape:"Yes",noInsects:"Yes",noBlackSpots:"Yes",
   verdict:"Approved",finalGrade:"Premium",date:"11 Mar 2026",sync:"synced",g1:48,g2:4,mix:0,notes:"Excellent quality batch",att:[{n:"Sample Overview",t:"photo",s:"✓"},{n:"Leaf Detail",t:"photo",s:"✓"},{n:"Moisture Meter",t:"photo",s:"✓"},{n:"Bale Cross-section",t:"photo",s:"✓"}]},
  {id:"QC-0027",type:"received",ref:"RCV-0042",supplier:"Al-Wataniya",commodity:"Alfalfa",grade:"G1",site:"Ain Sokhna",inspector:"Adam Mohamed",bales:48,netWeight:18600,
   color:"Green",leafRatio:"78%",foreignMatter:"2.1%",odor:"Fresh",moisture:"12.4%",moistureWeight:"5%",protein:"16.8%",density:"High",avgWeight:"387",baleHeight:"40",
   truckClean:"Yes",hasCover:"Yes",strapGood:"Yes",stackGood:"Yes",noWeeds:"Yes",baleTies:"Good",baleShape:"Yes",noInsects:"Yes",noBlackSpots:"Yes",
   verdict:"Approved",finalGrade:"G1",date:"10 Mar 2026",sync:"synced",g1:42,g2:6,mix:0,notes:"",att:[{n:"Sample Overview",t:"photo",s:"✓"},{n:"Leaf Detail",t:"photo",s:"✓"},{n:"Moisture Meter",t:"photo",s:"✓"},{n:"Foreign Matter",t:"photo",s:"✓"}]},
  {id:"QC-0026",type:"received",ref:"RCV-0041",supplier:"Delta Agri",commodity:"Rhodes Grass",grade:"G1",site:"Dakhla",inspector:"Essam Abdulla",bales:38,netWeight:14700,
   color:"Light Green",leafRatio:"72%",foreignMatter:"2.8%",odor:"Normal",moisture:"13.1%",moistureWeight:"8%",protein:"12.4%",density:"Medium",avgWeight:"386",baleHeight:"38",
   truckClean:"No",hasCover:"Yes",strapGood:"No",stackGood:"Yes",noWeeds:"Yes",baleTies:"Fair",baleShape:"No",noInsects:"Yes",noBlackSpots:"Yes",
   verdict:"Approved",finalGrade:"G1",date:"09 Mar 2026",sync:"pending",g1:32,g2:6,mix:0,notes:"Slight discoloration on 3 bales",att:[{n:"Sample Overview",t:"photo",s:"✓"},{n:"Discolored Bales",t:"photo",s:"✓"},{n:"Moisture Meter",t:"photo",s:"✓"}]},
  {id:"QC-0023",type:"received",ref:"RCV-0040",supplier:"Nile Valley",commodity:"Alfalfa",grade:"Standard",site:"Ain Sokhna",inspector:"Adam Mohamed",bales:95,netWeight:22400,
   color:"Yellow-Green",leafRatio:"62%",foreignMatter:"4.2%",odor:"Slightly Musty",moisture:"14.8%",moistureWeight:"18%",protein:"13.1%",density:"Low",avgWeight:"235",baleHeight:"32",
   truckClean:"No",hasCover:"No",strapGood:"No",stackGood:"No",noWeeds:"No",baleTies:"Poor",baleShape:"No",noInsects:"No",noBlackSpots:"No",
   verdict:"Rejected",finalGrade:"G2",date:"08 Mar 2026",sync:"synced",g1:60,g2:25,mix:10,notes:"High moisture — needs drying before pressing",att:[{n:"Sample Overview",t:"photo",s:"✓"},{n:"Foreign Matter Close-up",t:"photo",s:"✓"},{n:"Moisture Meter",t:"photo",s:"✓"},{n:"Musty Area",t:"photo",s:"✓"}]},
  {id:"QC-0022",type:"received",ref:"RCV-0036",supplier:"Upper Egypt Co-op",commodity:"Alfalfa",grade:"G1",site:"Dakhla",inspector:"Essam Abdulla",bales:50,netWeight:19400,
   color:"Green",leafRatio:"80%",foreignMatter:"1.8%",odor:"Fresh",moisture:"11.2%",moistureWeight:"2%",protein:"16.5%",density:"High",avgWeight:"388",baleHeight:"41",
   truckClean:"Yes",hasCover:"Yes",strapGood:"Yes",stackGood:"Yes",noWeeds:"Yes",baleTies:"Good",baleShape:"Yes",noInsects:"Yes",noBlackSpots:"Yes",
   verdict:"Approved",finalGrade:"G1",date:"25 Feb 2026",sync:"synced",g1:44,g2:6,mix:0,notes:"",att:[{n:"Sample Overview",t:"photo",s:"✓"},{n:"Leaf Detail",t:"photo",s:"✓"},{n:"Moisture Meter",t:"photo",s:"✓"}]},
  {id:"QC-0021",type:"received",ref:"RCV-0035",supplier:"Nile Valley",commodity:"Alfalfa",grade:"Premium",site:"Ain Sokhna",inspector:"Adam Mohamed",bales:54,netWeight:21000,
   color:"Dark Green",leafRatio:"86%",foreignMatter:"0.9%",odor:"Fresh",moisture:"10.8%",moistureWeight:"1%",protein:"18.5%",density:"High",avgWeight:"389",baleHeight:"43",
   truckClean:"Yes",hasCover:"Yes",strapGood:"Yes",stackGood:"Yes",noWeeds:"Yes",baleTies:"Good",baleShape:"Yes",noInsects:"Yes",noBlackSpots:"Yes",
   verdict:"Approved",finalGrade:"Premium",date:"18 Feb 2026",sync:"synced",g1:50,g2:4,mix:0,notes:"Excellent batch",att:[{n:"Sample Overview",t:"photo",s:"✓"},{n:"Leaf Detail",t:"photo",s:"✓"},{n:"Moisture Meter",t:"photo",s:"✓"},{n:"Bale Cross-section",t:"photo",s:"✓"}]},
  // Press QC — produced double-pressed bales
  {id:"QC-0025",type:"pressed",ref:"DPR-0018",pressLine:"Press 1",batch:"20260310-01",commodity:"Alfalfa",grade:"G1",site:"Ain Sokhna",inspector:"Adam Mohamed",bales:220,outWeight:18200,baleCode:"BL-20260310-A",
   color:"Dark Green",leafRatio:"82%",foreignMatter:"0.8%",odor:"Fresh",moisture:"10.2%",protein:"17.5%",density:"High",avgWeight:"83",
   verdict:"Approved",finalGrade:"Premium",date:"10 Mar 2026",sync:"synced",g1:220,g2:18,mix:2,notes:"Post-press quality excellent",att:[{n:"Pressed Bale Front",t:"photo",s:"✓"},{n:"Pressed Bale Side",t:"photo",s:"✓"},{n:"Density Check",t:"photo",s:"✓"},{n:"Strap Condition",t:"photo",s:"✓"},{n:"Grade Label",t:"photo",s:"✓"}]},
  {id:"QC-0024",type:"pressed",ref:"DPR-0017",pressLine:"Press 2",batch:"20260308-01",commodity:"Alfalfa",grade:"Premium",site:"Ain Sokhna",inspector:"Essam Abdulla",bales:210,outWeight:21800,baleCode:"BL-20260308-B",
   color:"Green",leafRatio:"76%",foreignMatter:"1.5%",odor:"Fresh",moisture:"11.5%",protein:"16.2%",density:"Medium",avgWeight:"104",
   verdict:"Approved",finalGrade:"Premium",date:"08 Mar 2026",sync:"synced",g1:180,g2:32,mix:8,notes:"",att:[{n:"Pressed Bale Front",t:"photo",s:"✓"},{n:"Pressed Bale Side",t:"photo",s:"✓"},{n:"Density Check",t:"photo",s:"✓"},{n:"Strap Condition",t:"photo",s:"✓"}]},
];

// Press operations
const DPR=[
  {id:"DPR-0019",site:"Ain Sokhna",line:"Press 1",batch:"20260311-01",operator:"Yasser Hussin",shift:"Morning",commodity:"Alfalfa",inBales:52,inWeight:20200,inGrade:"Premium",outBales:240,outWeight:19800,outAvgBale:82,density:"High",startTime:"06:00",endTime:"14:30",fuel:120,oilTemp:"78°C",oilPressure:"210 bar",sources:"RCV-0043",date:"11 Mar 2026",sync:"processing",crew:[{role:"🚛 Drivers",ppl:["Mohamed Murad","Mahmoud Abdul Hakeem"]},{role:"👔 Baling Supervisors",ppl:["Ahmed Yousef","Mohamed Blal"]},{role:"🔍 Quality Supervisors",ppl:["Adam Mohamed","Essam Abdulla"]},{role:"⚙ Baling Labors",ppl:["Magdy Abdul Ghani","Musa Omar","Housam Sebaq"]},{role:"👷 Quality Labors",ppl:["Montsr Mohamed","Omar Alaa"]}],att:[{n:"Input Bales",t:"photo",s:"✓"},{n:"Output Bales",t:"photo",s:"✓"},{n:"Output Batch",t:"photo",s:"✓"},{n:"Bale Dimensions",t:"photo",s:"✓"},{n:"Bale Count Log",t:"photo",s:"✓"}]},
  {id:"DPR-0018",site:"Ain Sokhna",line:"Press 1",batch:"20260310-01",operator:"Yasser Hussin",shift:"Morning",commodity:"Alfalfa",inBales:48,inWeight:18600,inGrade:"G1",outBales:220,outWeight:18200,outAvgBale:83,density:"High",startTime:"06:00",endTime:"13:45",fuel:115,oilTemp:"76°C",oilPressure:"205 bar",sources:"RCV-0042",date:"10 Mar 2026",sync:"synced",crew:[{role:"🚛 Drivers",ppl:["Mohamed Murad"]},{role:"👔 Baling Supervisors",ppl:["Ahmed Yousef"]},{role:"🔍 Quality Supervisors",ppl:["Adam Mohamed"]},{role:"⚙ Baling Labors",ppl:["Magdy Abdul Ghani","Musa Omar"]},{role:"👷 Quality Labors",ppl:["Montsr Mohamed"]}],att:[{n:"Input Bales",t:"photo",s:"✓"},{n:"Output Bales",t:"photo",s:"✓"},{n:"Output Batch",t:"photo",s:"✓"},{n:"Bale Dimensions",t:"photo",s:"✓"},{n:"Bale Count Log",t:"photo",s:"✓"}]},
  {id:"DPR-0017",site:"Ain Sokhna",line:"Press 2",batch:"20260308-01",operator:"Mohamed Blal",shift:"Morning",commodity:"Alfalfa",inBales:95,inWeight:22400,inGrade:"Standard",outBales:210,outWeight:21800,outAvgBale:104,density:"Medium",startTime:"06:30",endTime:"15:00",fuel:135,oilTemp:"80°C",oilPressure:"215 bar",sources:"RCV-0040",date:"08 Mar 2026",sync:"synced",crew:[{role:"🚛 Drivers",ppl:["Mahmoud Abdul Hakeem","Fadl El Mola"]},{role:"👔 Baling Supervisors",ppl:["Mohamed Blal"]},{role:"🔍 Quality Supervisors",ppl:["Essam Abdulla"]},{role:"⚙ Baling Labors",ppl:["Housam Sebaq","Montsr Mohamed","Abdul Hamid Assem"]},{role:"👷 Quality Labors",ppl:["Omar Alaa","Moaz El Nazeer"]}],att:[{n:"Input Bales",t:"photo",s:"✓"},{n:"Output Bales",t:"photo",s:"✓"},{n:"Output Batch",t:"photo",s:"✓"},{n:"Bale Dimensions",t:"photo",s:"✓"},{n:"Bale Count Log",t:"photo",s:"✓"}]},
  {id:"DPR-0016",site:"Ain Sokhna",line:"Press 1",batch:"20260307-01",operator:"Yasser Hussin",shift:"Afternoon",commodity:"Rhodes Grass",inBales:35,inWeight:13000,inGrade:"Standard",outBales:150,outWeight:12700,outAvgBale:85,density:"Medium",startTime:"14:00",endTime:"21:00",fuel:105,oilTemp:"74°C",oilPressure:"195 bar",sources:"RCV-0037",date:"07 Mar 2026",sync:"synced",crew:[{role:"🚛 Drivers",ppl:["Mohamed Murad"]},{role:"👔 Baling Supervisors",ppl:["Ahmed Yousef"]},{role:"🔍 Quality Supervisors",ppl:["Adam Mohamed"]},{role:"⚙ Baling Labors",ppl:["Magdy Abdul Ghani","Musa Omar"]},{role:"👷 Quality Labors",ppl:["Essam Abdulla"]}],att:[{n:"Input Bales",t:"photo",s:"✓"},{n:"Output Bales",t:"photo",s:"✓"},{n:"Output Batch",t:"photo",s:"✓"},{n:"Bale Dimensions",t:"photo",s:"✓"},{n:"Bale Count Log",t:"photo",s:"✓"}]},
];

// Internal transfers — Dakhla → Sokhna
const TRF=[
  {id:"TRF-0012",from:"Dakhla Farm",to:"Ain Sokhna",commodity:"Alfalfa",grade:"G1",press:"SP",bales:95,weight:22400,tare:8200,plate:"ص ع د 2810",crew:[{role:"🚛 Driver",ppl:["Fadl El Mola"]},{role:"👷 Loading Crew",ppl:["Mansour Ali","Abu Bakr Talha"]}],truck:"Flatbed 12m",phone:"01098765432",sources:"DPR-0019",freight:8500,loadDate:"11 Mar 2026",loadTime:"05:30",eta:"11 Mar 18:00",arrDate:"",arrTime:"",condition:"",status:"in_transit",sync:"synced",distance:"780 km",notes:"Loaded at dawn, highway route via Red Sea road",seal:"SL-00482",att:[{n:"Loaded Truck",t:"photo",s:"✓"},{n:"Weighbridge Ticket",t:"photo",s:"✓"},{n:"License Plate",t:"photo",s:"✓"},{n:"Waybill",t:"doc",s:"✓"},{n:"Driver License",t:"doc",s:"✓"},{n:"Driver ID",t:"doc",s:"✓"},{n:"Right Side",t:"photo",s:"✓"},{n:"Left Side",t:"photo",s:"✓"},{n:"Rear Load",t:"photo",s:"✓"}]},
  {id:"TRF-0011",from:"Dakhla Farm",to:"Ain Sokhna",commodity:"Alfalfa",grade:"Premium",press:"SP",bales:88,weight:20600,tare:8200,plate:"ص ع د 2810",crew:[{role:"🚛 Driver",ppl:["Fadl El Mola"]},{role:"👷 Loading Crew",ppl:["Mansour Ali","Abu Bakr Talha"]},{role:"📦 Receiving Crew",ppl:["Magdy Abdul Ghani","Musa Omar"]}],truck:"Flatbed 12m",phone:"01098765432",sources:"DPR-0018",freight:8500,loadDate:"09 Mar 2026",loadTime:"06:00",eta:"09 Mar 18:30",arrDate:"09 Mar 2026",arrTime:"19:15",condition:"Intact",status:"delivered",sync:"synced",distance:"780 km",notes:"45min delay at Hurghada checkpoint",seal:"SL-00481",att:[{n:"Loaded Truck",t:"photo",s:"✓"},{n:"Weighbridge Ticket",t:"photo",s:"✓"},{n:"License Plate",t:"photo",s:"✓"},{n:"Waybill",t:"doc",s:"✓"},{n:"Driver License",t:"doc",s:"✓"},{n:"Driver ID",t:"doc",s:"✓"},{n:"Right Side",t:"photo",s:"✓"},{n:"Left Side",t:"photo",s:"✓"},{n:"Rear Load",t:"photo",s:"✓"},{n:"Arrival Truck",t:"photo",s:"✓"},{n:"Bale Condition",t:"photo",s:"✓"}]},
  {id:"TRF-0010",from:"Dakhla Farm",to:"Ain Sokhna",commodity:"Rhodes Grass",grade:"G1",press:"SP",bales:72,weight:16800,tare:7400,plate:"ن ع ب 3912",crew:[{role:"🚛 Driver",ppl:["Mahmoud Ota"]},{role:"👷 Loading Crew",ppl:["Musa Omar"]}],truck:"Flatbed 10m",phone:"01112345678",sources:"DPR-0016",freight:7000,loadDate:"07 Mar 2026",loadTime:"05:00",eta:"07 Mar 17:00",arrDate:"07 Mar 2026",arrTime:"17:40",condition:"Intact",status:"delivered",sync:"synced",distance:"780 km",notes:"",seal:"SL-00480",att:[{n:"Loaded Truck",t:"photo",s:"✓"},{n:"Weighbridge Ticket",t:"photo",s:"✓"},{n:"License Plate",t:"photo",s:"✓"},{n:"Waybill",t:"doc",s:"✓"},{n:"Driver License",t:"doc",s:"✓"},{n:"Driver ID",t:"doc",s:"✓"},{n:"Right Side",t:"photo",s:"✓"},{n:"Left Side",t:"photo",s:"✓"},{n:"Rear Load",t:"photo",s:"✓"},{n:"Arrival Truck",t:"photo",s:"✓"},{n:"Bale Condition",t:"photo",s:"✓"}]},
  {id:"TRF-0009",from:"Dakhla Farm",to:"Ain Sokhna",commodity:"Alfalfa",grade:"Standard",press:"SP",bales:110,weight:25800,tare:8200,plate:"ص ع د 2810",crew:[{role:"🚛 Driver",ppl:["Fadl El Mola"]},{role:"👷 Loading Crew",ppl:["Mansour Ali","Abu Bakr Talha","Mohamed Alam"]},{role:"📦 Receiving Crew",ppl:["Magdy Abdul Ghani","Housam Sebaq"]}],truck:"Flatbed 12m",phone:"01098765432",sources:"DPR-0017",freight:8500,loadDate:"05 Mar 2026",loadTime:"04:30",eta:"05 Mar 17:00",arrDate:"05 Mar 2026",arrTime:"16:45",condition:"Intact",status:"received",sync:"synced",distance:"780 km",notes:"Received and weighed at Sokhna",seal:"SL-00479",rcvWeight:25400,diff:-400,att:[{n:"Loaded Truck",t:"photo",s:"✓"},{n:"Weighbridge Ticket",t:"photo",s:"✓"},{n:"License Plate",t:"photo",s:"✓"},{n:"Waybill",t:"doc",s:"✓"},{n:"Driver License",t:"doc",s:"✓"},{n:"Driver ID",t:"doc",s:"✓"},{n:"Right Side",t:"photo",s:"✓"},{n:"Left Side",t:"photo",s:"✓"},{n:"Rear Load",t:"photo",s:"✓"},{n:"Arrival Truck",t:"photo",s:"✓"},{n:"Bale Condition",t:"photo",s:"✓"},{n:"Arrival Weighbridge",t:"photo",s:"✓"}]},
  {id:"TRF-0008",from:"Dakhla Farm",to:"Ain Sokhna",commodity:"Alfalfa",grade:"G1",press:"SP",bales:82,weight:19200,tare:7400,plate:"ن ع ب 3912",crew:[{role:"🚛 Driver",ppl:["Mahmoud Ota"]},{role:"👷 Loading Crew",ppl:["Musa Omar","Abu Bakr Talha"]},{role:"📦 Receiving Crew",ppl:["Magdy Abdul Ghani","Montsr Mohamed"]}],truck:"Flatbed 10m",phone:"01112345678",sources:"DPR-0017",freight:7000,loadDate:"03 Mar 2026",loadTime:"05:30",eta:"03 Mar 17:30",arrDate:"03 Mar 2026",arrTime:"18:10",condition:"Partial Damage",status:"received",sync:"synced",distance:"780 km",notes:"Minor tarp tear — 2 bales slightly wet",seal:"SL-00478",rcvWeight:19050,diff:-150,att:[{n:"Loaded Truck",t:"photo",s:"✓"},{n:"Weighbridge Ticket",t:"photo",s:"✓"},{n:"License Plate",t:"photo",s:"✓"},{n:"Waybill",t:"doc",s:"✓"},{n:"Driver License",t:"doc",s:"✓"},{n:"Driver ID",t:"doc",s:"✓"},{n:"Right Side",t:"photo",s:"✓"},{n:"Left Side",t:"photo",s:"✓"},{n:"Rear Load",t:"photo",s:"✓"},{n:"Arrival Truck",t:"photo",s:"✓"},{n:"Bale Condition",t:"photo",s:"✓"},{n:"Arrival Weighbridge",t:"photo",s:"✓"},{n:"Tarp Damage",t:"photo",s:"✓"}]},
  {id:"TRF-0007",from:"Dakhla Farm",to:"Ain Sokhna",commodity:"Alfalfa",grade:"Premium",press:"SP",bales:90,weight:21100,tare:8200,plate:"ص ع د 2810",crew:[{role:"🚛 Driver",ppl:["Fadl El Mola"]},{role:"👷 Loading Crew",ppl:["Mansour Ali","Abu Bakr Talha"]},{role:"📦 Receiving Crew",ppl:["Magdy Abdul Ghani","Musa Omar","Housam Sebaq"]}],truck:"Flatbed 12m",phone:"01098765432",sources:"DPR-0018",freight:8500,loadDate:"01 Mar 2026",loadTime:"06:00",eta:"01 Mar 18:00",arrDate:"01 Mar 2026",arrTime:"18:30",condition:"Intact",status:"received",sync:"synced",distance:"780 km",notes:"",seal:"SL-00477",rcvWeight:20950,diff:-150,att:[{n:"Loaded Truck",t:"photo",s:"✓"},{n:"Weighbridge Ticket",t:"photo",s:"✓"},{n:"License Plate",t:"photo",s:"✓"},{n:"Waybill",t:"doc",s:"✓"},{n:"Driver License",t:"doc",s:"✓"},{n:"Driver ID",t:"doc",s:"✓"},{n:"Right Side",t:"photo",s:"✓"},{n:"Left Side",t:"photo",s:"✓"},{n:"Rear Load",t:"photo",s:"✓"},{n:"Arrival Truck",t:"photo",s:"✓"},{n:"Bale Condition",t:"photo",s:"✓"},{n:"Arrival Weighbridge",t:"photo",s:"✓"}]},
];

const TRS={in_transit:{bg:"#FDF6EC",c:"#D4960A",l:"🚛 In Transit"},delivered:{bg:"#E4EFE6",c:"#2D5A3D",l:"📍 Delivered"},received:{bg:"#E4EFE6",c:"#4A7C59",l:"✓ Received & Weighed"},loading:{bg:"#F2F7F3",c:"#4A7C59",l:"⟳ Loading"}};

// Shipment stages
const RCV_STAGES=["shipped","received","qc_done"];
const RCV_SL={shipped:"🚛 Shipped",received:"📦 Received",qc_done:"✅ QC Assessed"};
const TRF_STAGES=["loaded","in_transit","delivered","received"];
const TRF_SL={loaded:"📦 Loaded",in_transit:"🚛 In Transit",delivered:"📍 Delivered",received:"✅ Received"};

export default function OfflineOpsModule(){
  // ─── Company Selector State ──────────────────────────────────────────────
  const [activeCompany, setActiveCompanyRaw] = useState("ALL");
  const companiesResolvedRef = useRef(false);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const companyRef = useRef(null);

  // Fetch Odoo companies and user access
  const { data: odooCompanies, isLoading: companiesLoading } = trpc.odoo.companies.useQuery();
  const { data: companyAccessData } = trpc.userMgmt.myCompanyAccess.useQuery();

  const allCompaniesRaw = useMemo(() => (odooCompanies ?? []).map(c => ({
    id: String(c.id), odooId: c.id, name: c.name, displayName: c.displayName,
    currency: c.currency, country: c.country,
  })), [odooCompanies]);

  const companies = useMemo(() => {
    if (!companyAccessData) return [];
    const { allowedCompanyIds } = companyAccessData;
    if (!allowedCompanyIds.length) return allCompaniesRaw;
    return allCompaniesRaw.filter(c => allowedCompanyIds.includes(c.odooId));
  }, [allCompaniesRaw, companyAccessData]);

  // Resolve default company (same logic as Home.tsx)
  useEffect(() => {
    if (companiesResolvedRef.current || !companies.length || !companyAccessData) return;
    companiesResolvedRef.current = true;
    const { defaultCompanyId } = companyAccessData;
    const userIsAdmin = companyAccessData.isAdmin || companyAccessData.allowedCompanyIds.length === 0;
    if (!userIsAdmin) {
      if (defaultCompanyId !== null) {
        const co = companies.find(c => c.odooId === defaultCompanyId);
        if (co) { setActiveCompanyRaw(co.id); return; }
      }
      if (companies.length > 0) { setActiveCompanyRaw(companies[0].id); }
      return;
    }
    // Admin: respect localStorage
    const saved = localStorage.getItem('platfarm_company');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p.id === 'ALL') return;
        if (typeof p.id === 'number') {
          const co = companies.find(c => c.odooId === p.id);
          if (co) { setActiveCompanyRaw(co.id); return; }
        }
      } catch { /* ignore */ }
    }
    if (defaultCompanyId !== null) {
      const co = companies.find(c => c.odooId === defaultCompanyId);
      if (co) { setActiveCompanyRaw(co.id); return; }
    }
    const cairo = companies.find(c => c.name?.toLowerCase().includes('cairo'));
    if (cairo) { setActiveCompanyRaw(cairo.id); return; }
    if (companies.length > 0) setActiveCompanyRaw(companies[0].id);
  }, [companies, companyAccessData]);

  // Prevent restricted users from selecting ALL
  useEffect(() => {
    if (!companyAccessData || !companies.length) return;
    const isAdm = companyAccessData.isAdmin || companyAccessData.allowedCompanyIds.length === 0;
    if (!isAdm && activeCompany === "ALL") {
      const first = companies[0];
      if (first) setActiveCompanyRaw(first.id);
    }
  }, [companyAccessData, companies, activeCompany]);

  const setActiveCompany = (val) => {
    setActiveCompanyRaw(val);
    if (val === 'ALL') {
      localStorage.setItem('platfarm_company', JSON.stringify({ id: 'ALL', name: 'All Companies' }));
    } else {
      const comp = companies.find(c => c.id === val);
      if (comp) localStorage.setItem('platfarm_company', JSON.stringify({ id: comp.odooId, name: comp.name }));
    }
  };

  const activeCompanyObj = companies.find(c => c.id === activeCompany);
  const companyLabel = activeCompany === "ALL" ? "All Companies" : activeCompanyObj?.name || activeCompany;
  const isCompanyAdmin = !!companyAccessData && (companyAccessData.isAdmin || companyAccessData.allowedCompanyIds.length === 0);
  const activeOdooCompanyId = activeCompany === "ALL" ? undefined : activeCompanyObj?.odooId;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (companyRef.current && !companyRef.current.contains(e.target)) setCompanyDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch live data from Odoo via tRPC
  const [, setLocation] = useLocation();
  const { data: liveData, isLoading: isLoadingData, error: dataError } = trpc.offlineOps.allData.useQuery({ limit: 200, companyId: activeOdooCompanyId }, { staleTime: 60_000, refetchOnWindowFocus: false });

  const[pg,setPg]=useState("dash");
  const[sc,setSc]=useState(false);
  const[sr,setSr]=useState("");
  const[sel,setSel]=useState(null);
  const[selType,setSelType]=useState(null);
  const[syncF,setSyncF]=useState("all");
  const[siteF,setSiteF]=useState("All");
  const[qcTypeF,setQcTypeF]=useState("all");
  const[trfSt,setTrfSt]=useState("all");
  const[rcvStg,setRcvStg]=useState("all");
  const[prd,setPrd]=useState("all");
  const[cFrom,setCFrom]=useState("");
  const[cTo,setCTo]=useState("");
  const[showCust,setShowCust]=useState(false);
  const[detTab,setDetTab]=useState(0);
  const[prvAtt,setPrvAtt]=useState(null);
  const[showShipWiz,setShowShipWiz]=useState(false);
  const[conversionStatus,setConversionStatus]=useState<Record<string,{poId:number,poName:string}>>({});
  const[convLoading,setConvLoading]=useState(false);
  const[convError,setConvError]=useState("");

  // tRPC mutations for procurement → PO conversion
  const utils = trpc.useUtils();
  const linkProcMutation = trpc.offlineOps.linkProcurementToPO.useMutation();
  const copyProcAttMutation = trpc.offlineOps.copyProcurementAttachments.useMutation();
  const copyQcAttMutation = trpc.offlineOps.copyQualityAttachments.useMutation();
  const pushQcToReceiptMutation = trpc.offlineOps.pushQualityToReceipt.useMutation();
  const [pushQcStatus, setPushQcStatus] = useState<Record<number,string>>({});
  const [imgCache, setImgCache] = useState<Record<number,string>>({});
  const loadImgRef = useRef<Set<number>>(new Set());
  const loadImg = useCallback((irAttId: number) => {
    if (!irAttId || loadImgRef.current.has(irAttId)) return;
    loadImgRef.current.add(irAttId);
    setImgCache(p => ({ ...p, [irAttId]: "loading" }));
    utils.offlineOps.attachmentImage.fetch({ irAttachmentId: irAttId }).then(res => {
      if (res?.data) {
        setImgCache(p => ({ ...p, [irAttId]: `data:${res.mimetype};base64,${res.data}` }));
      } else {
        setImgCache(p => ({ ...p, [irAttId]: "none" }));
      }
    }).catch(() => {
      setImgCache(p => ({ ...p, [irAttId]: "none" }));
    });
  }, [utils]);

  // DPR → MO conversion state
  const[showProdWiz,setShowProdWiz]=useState(false);
  const[dprConversionStatus,setDprConversionStatus]=useState<Record<string,{moId:number,moName:string}>>({});
  const[dprConvLoading,setDprConvLoading]=useState(false);
  const[showNewTransfer,setShowNewTransfer]=useState(false);
  const[dprConvError,setDprConvError]=useState("");

  // tRPC mutations for pressing → MO conversion
  const linkPressMutation = trpc.offlineOps.linkPressingToMO.useMutation();
  const copyPressAttMutation = trpc.offlineOps.copyPressingAttachments.useMutation();

  // Derive linked MO name — priority: in-memory state > authoritative Odoo field > notes text fallback
  const getLinkedMo = useCallback((rec) => {
    if (!rec) return null;
    if (dprConversionStatus[rec.id]) return dprConversionStatus[rec.id];
    // Authoritative Odoo field (set by linkPressingToMO)
    if (rec.linkedMoName) return { moName: rec.linkedMoName, moId: rec.linkedMoId || 0 };
    // Legacy notes fallback
    const match = (rec.notes || "").match(/\[Converted to ([^|]+) \| MO ID: (\d+)\]/);
    if (match) return { moName: match[1].trim(), moId: Number(match[2]) };
    return null;
  }, [dprConversionStatus]);

  // Derive linked PO name — priority: in-memory state > authoritative Odoo field > notes text fallback
  const getLinkedPo = useCallback((rec) => {
    if (!rec) return null;
    // Check in-memory conversion status first
    if (conversionStatus[rec.id]) return conversionStatus[rec.id];
    // Authoritative Odoo field (set by linkProcurementToPO)
    if (rec.linkedPoName) return { poName: rec.linkedPoName, poId: rec.linkedPoId || 0 };
    // Legacy notes fallback
    const match = (rec.notes || "").match(/\[Converted to ([^|]+) \| PO ID: (\d+)\]/);
    if (match) return { poName: match[1].trim(), poId: Number(match[2]) };
    return null;
  }, [conversionStatus]);
  const getLinkedReceipt = useCallback((rec) => {
    if (!rec) return "";
    if (rec.linkedReceipt) return rec.linkedReceipt;
    const match = (rec.notes || "").match(/\[Receipt: ([^|]+) \| Picking IDs:/);
    if (match) return match[1].trim();
    return "";
  }, []);
  const W=sc?48:190;
  const NOW=new Date(2026,2,11);// Mar 11, 2026
  const parseD=(s)=>{if(!s)return null;const p=s.match(/(\d+)\s+(\w+)\s+(\d+)/);if(!p)return null;const mi={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};return new Date(+p[3],mi[p[2]]||0,+p[1]);};
  const inPrd=(d)=>{if(prd==="all")return true;const dt=parseD(d);if(!dt)return true;if(prd==="7d")return(NOW-dt)/(864e5)<=7;if(prd==="30d")return(NOW-dt)/(864e5)<=30;if(prd==="90d")return(NOW-dt)/(864e5)<=90;if(prd==="custom"){const f=cFrom?new Date(cFrom):null;const t=cTo?new Date(cTo):null;if(f&&dt<f)return false;if(t&&dt>t)return false;return true;}return true;};

  // Use live data if available, otherwise fall back to hardcoded demo data
  const RCV = liveData?.RCV?.length ? liveData.RCV : EMPTY_RCV;
  const QC = liveData?.QC?.length ? liveData.QC : EMPTY_QC;
  const DPR = liveData?.DPR?.length ? liveData.DPR : EMPTY_DPR;
  const TRF = liveData?.TRF?.length ? liveData.TRF : EMPTY_TRF;

  // Period-filtered base (for totals + dashboard)
  const pRcv=RCV.filter(x=>inPrd(x.date));const pQc = QC.filter(q=>q.type==="pressed").filter(x=>inPrd(x.date));const pDpr=DPR.filter(x=>inPrd(x.date));const pTrf=TRF.filter(x=>inPrd(x.loadDate));

  const synced=pRcv.filter(r=>r.sync==="synced").length+pQc.filter(r=>r.sync==="synced").length+pDpr.filter(r=>r.sync==="synced").length+pTrf.filter(r=>r.sync==="synced").length;
  const pending=pRcv.filter(r=>r.sync==="pending").length+pQc.filter(r=>r.sync==="pending").length+pDpr.filter(r=>r.sync==="pending").length;
  const errors=pRcv.filter(r=>r.sync==="error").length+pQc.filter(r=>r.sync==="error").length+pDpr.filter(r=>r.sync==="error").length;
  const total=pRcv.length+pQc.length+pDpr.length+pTrf.length;
  const totalNet=pRcv.reduce((s,r)=>s+r.net,0);
  const totalOut=pDpr.reduce((s,r)=>s+r.outWeight,0);
  const totalTrf=pTrf.reduce((s,r)=>s+r.weight,0);
  const inTransit=pTrf.filter(r=>r.status==="in_transit");
  const totalLoss=pTrf.filter(r=>r.diff).reduce((s,r)=>s+Math.abs(r.diff||0),0);

  // Page-specific filters (sync, stage, site, search — on top of period)
  let fRcv=pRcv.slice();let fQc=pQc.slice();let fDpr=pDpr.slice();
  if(syncF!=="all"){fRcv=fRcv.filter(x=>x.sync===syncF);fQc=fQc.filter(x=>x.sync===syncF);fDpr=fDpr.filter(x=>x.sync===syncF);}
  if(rcvStg!=="all")fRcv=fRcv.filter(x=>x.stage===rcvStg);
  if(siteF!=="All"){fRcv=fRcv.filter(x=>x.site.includes(siteF));fQc=fQc.filter(x=>x.site.includes(siteF));fDpr=fDpr.filter(x=>x.site.includes(siteF));}
  if(sr){const q=sr.toLowerCase();fRcv=fRcv.filter(x=>x.id.toLowerCase().includes(q)||x.supplier.toLowerCase().includes(q)||x.commodity.toLowerCase().includes(q));fQc=fQc.filter(x=>x.id.toLowerCase().includes(q)||x.ref.toLowerCase().includes(q)||x.inspector.toLowerCase().includes(q));fDpr=fDpr.filter(x=>x.id.toLowerCase().includes(q)||x.operator.toLowerCase().includes(q));}

  let fTrf=pTrf.slice();
  if(syncF!=="all")fTrf=fTrf.filter(x=>x.sync===syncF);
  if(trfSt!=="all")fTrf=fTrf.filter(x=>x.status===trfSt);
  if(sr&&pg==="trf")fTrf=fTrf.filter(x=>x.id.toLowerCase().includes(sr.toLowerCase())||(x.crew||[]).some(c=>(c.ppl||[]).some(p=>p.toLowerCase().includes(sr.toLowerCase()))));

  const bd=(t,l)=>{const s=SY[t]||SY.pending;return <span style={{display:"inline-flex",padding:"2px 10px",borderRadius:99,fontSize:10,fontWeight:600,background:s.bg,color:s.c,whiteSpace:"nowrap"}}>{l||s.l}</span>;};
  const pipe=(stages,labels,current)=>{const idx=stages.indexOf(current);return(<div style={{display:"flex",alignItems:"center",gap:0,padding:"12px 18px",borderBottom:"1px solid #E4E1DC",background:"#FAFAF8"}}>
    {stages.map((st,i)=>{const done=i<=idx;const active=i===idx;return(<div key={st} style={{display:"flex",alignItems:"center",flex:i<stages.length-1?1:"none"}}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
        <div style={{width:active?28:22,height:active?28:22,borderRadius:14,background:done?"#2D5A3D":"#E4E1DC",color:done?"#fff":"#95A09C",display:"flex",alignItems:"center",justifyContent:"center",fontSize:active?11:9,fontWeight:700,border:active?"2px solid #C0714A":"none",transition:"all .2s"}}>{done?"✓":i+1}</div>
        <span style={{fontSize:8,fontWeight:done?700:500,color:done?"#2D5A3D":"#95A09C",whiteSpace:"nowrap",maxWidth:70,overflow:"hidden",textOverflow:"ellipsis"}}>{labels[st]}</span>
      </div>
      {i<stages.length-1&&<div style={{flex:1,height:2,background:i<idx?"#2D5A3D":"#E4E1DC",margin:"0 4px",marginBottom:14,borderRadius:1}}/>}
    </div>);})}</div>);};
  const rcvStage=(st)=>{const m={shipped:{bg:"#FDF6EC",c:"#D4960A",l:"🚛 Shipped"},received:{bg:"#E4EFE6",c:"#4A7C59",l:"📦 Received"},qc_done:{bg:"#E4EFE6",c:"#2D5A3D",l:"✅ QC Done"}};const s=m[st]||m.shipped;return <span style={{display:"inline-flex",padding:"2px 8px",borderRadius:99,fontSize:9,fontWeight:600,background:s.bg,color:s.c,whiteSpace:"nowrap"}}>{s.l}</span>;};
  const siteBd=(s)=>{const dk=s&&s.includes("Dakhla");return <span style={{display:"inline-flex",alignItems:"center",gap:3,padding:"2px 8px",borderRadius:99,fontSize:9,fontWeight:700,background:dk?"#FDF7F3":"#E4EFE6",color:dk?"#C0714A":"#2D5A3D",whiteSpace:"nowrap",border:"1px solid "+(dk?"#C0714A20":"#2D5A3D20")}}>{dk?"🌿":"🏭"} {dk?"Dakhla":"Sokhna"}</span>;};
  const br=(v,mx,c,h)=>(<div style={{width:"100%",height:h||5,borderRadius:h||5,background:"#E4E1DC",overflow:"hidden"}}><div style={{height:"100%",borderRadius:h||5,background:c||"#2D5A3D",width:`${mx?Math.min(v/mx*100,100):0}%`}}/></div>);
  const pl=(l,a,fn)=>(<button key={l} onClick={fn} style={{padding:"6px 16px",borderRadius:99,fontSize:11,fontWeight:a?600:500,cursor:"pointer",border:a?"1px solid #2D5A3D":"1px solid #E8E5E0",background:a?"#2D5A3D":"#fff",color:a?"#fff":"#666",fontFamily:"'DM Sans',system-ui,sans-serif",letterSpacing:".1px"}}>{l}</button>);
  const openDet=(item,type)=>{setSel(item);setSelType(type);setDetTab(0);setPrvAtt(null);};

  return(
    <div style={{fontFamily:"'DM Sans', system-ui, sans-serif",background:"#F7F6F3",minHeight:"100vh"}}>
      <style>{`
        *{margin:0;padding:0;box-sizing:border-box}
        .ab{height:3px;background:linear-gradient(90deg,#2D5A3D,#C0714A)}
        .app-sb-ni{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;transition:all .2s;font-size:12px;font-weight:500;color:#64706C;white-space:nowrap;overflow:hidden;border-right:3px solid transparent;font-family:'DM Sans',system-ui,sans-serif}
        .t thead th{position:sticky;top:0;background:#FAFAF8;z-index:2;box-shadow:0 1px 0 #E4E1DC}
        .app-sb-ni:hover{background:#F2F7F3;color:#2D5A3D}.app-sb-ni.app-sb-act{background:#E4EFE6;color:#2D5A3D;font-weight:700;border-right-color:#2D5A3D}
        .sc{background:#F8FAF8;border-radius:9px;padding:12px 14px;border:1px solid #D5E5D5;transition:all .2s}
        .sc:hover{border-color:#4A7C59}
        .sl{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#888;font-weight:600;margin-bottom:4px;font-family:'DM Sans',system-ui,sans-serif}
        .sv{font-weight:700;color:#2C3E50;font-family:'JetBrains Mono',monospace;margin-top:2px}
        .ss{font-size:9px;color:#999;margin-top:3px;font-family:'DM Sans',system-ui,sans-serif}
        .xc{background:#fff;border:1px solid #E8E5E0;border-radius:9px;overflow:hidden}
        .xh{padding:10px 16px;display:flex;align-items:center;justify-content:space-between;border-radius:9px 9px 0 0}
        .xh h3{font-size:13px;font-weight:700;color:#fff;display:flex;align-items:center;gap:8px;font-family:'DM Sans',system-ui,sans-serif}
        .ct{background:rgba(255,255,255,.25);color:#fff;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;font-family:'JetBrains Mono',monospace}
        .t{width:100%;border-collapse:collapse}
        .t th{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;color:#4A7C59;padding:8px 10px;text-align:left;border-bottom:1.5px solid #E8E5E0;font-family:'DM Sans',system-ui,sans-serif}
        .t td{font-size:11px;padding:8px 10px;border-bottom:1px solid #F2F0EC;color:#2C3E50;vertical-align:middle;transition:background .15s}
        .t tbody tr{cursor:pointer;transition:background .15s}.t tbody tr:hover td{background:#F8FAF8}
        .m{font-family:'JetBrains Mono',monospace;font-weight:600}
        .dp{position:fixed;right:0;top:3px;bottom:0;width:380px;background:#FAFAF8;border-left:1.5px solid #E8E5E0;overflow-y:auto;z-index:45;box-shadow:-6px 0 24px rgba(0,0,0,.06);font-family:'DM Sans',system-ui,sans-serif}
        input{font-family:'DM Sans',system-ui,sans-serif;transition:all .2s}
        input:focus{border-color:#4A7C59;box-shadow:0 0 0 3px rgba(45,90,61,.1);outline:none}
        button{transition:all .2s}
`}</style>

      <div className="ab"/>
        {/* Sidebar + Content layout */}
        <div style={{display:"flex",minHeight:"calc(100vh - 3px)"}}>
          {/* Left Sidebar */}
          <div style={{width:200,minWidth:200,background:"#FAFAF8",borderRight:"1.5px solid #E8E5E0",paddingTop:12,display:"flex",flexDirection:"column"}}>
            <div style={{padding:"8px 16px 16px",fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:"#95A09C"}}>Navigation</div>
            <div className={"app-sb-ni"+(pg==="dash"?" app-sb-act":"")} onClick={()=>setPg("dash")}>
              <span style={{fontSize:16}}>📊</span><span>Dashboard</span>
            </div>
            <div className={"app-sb-ni"+(pg==="rcv"||pg==="incoming"?" app-sb-act":"")} onClick={()=>{setPg("incoming");setSr("");setSel(null);setSelType(null);}}>
              <ImgIcon src={ICON_PROCUREMENT} size={16} /><span>Procurement</span>
            </div>
            <div className={"app-sb-ni"+(pg==="qc"?" app-sb-act":"")} onClick={()=>setPg("qc")}>
              <span style={{fontSize:16}}>🔍</span><span>Double Press Quality</span>
            </div>
            <div className={"app-sb-ni"+(pg==="dpr"?" app-sb-act":"")} onClick={()=>setPg("dpr")}>
              <ImgIcon src={ICON_PRESSING} size={16} /><span>Pressing Shifts</span>
            </div>
            <div className={"app-sb-ni"+(pg==="trf"?" app-sb-act":"")} onClick={()=>setPg("trf")}>
              <ImgIcon src={ICON_TRANSFER} size={16} /><span>Transfers</span>
            </div>
          </div>
          {/* Main Content */}
          <div style={{flex:1,overflow:"auto"}}>

        {/* Error state */}
        {!isLoadingData&&dataError&&<div style={{margin:"24px",padding:"20px 24px",borderRadius:12,background:"#FDF0F0",border:"1px solid #F5C4C4"}}>
          <div style={{fontSize:14,fontWeight:700,color:"#C94444",marginBottom:6}}>Failed to load live data</div>
          <div style={{fontSize:11,color:"#95A09C",marginBottom:12}}>{dataError.message || "Could not connect to Odoo. Showing empty state."}</div>
          <div style={{fontSize:10,color:"#64706C"}}>The Odoo offline_operations module may not be installed or the API may be unreachable. Check server logs for details.</div>
        </div>}
        {pg==="dpr"&&<PressingShifts />}
        {pg==="incoming"&&<IncomingShipments />}
                {/* ═══ DASHBOARD ═══ */}
        {!isLoadingData&&pg==="dash"&&<div style={{padding:18}}>
          {/* Hero */}
          <div style={{background:"linear-gradient(135deg,#1B3A2D,#2D5A3D 60%,#4A7C59)",borderRadius:12,padding:"24px 28px",marginBottom:16,color:"#fff"}}>
            <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,opacity:.6,marginBottom:6}}>Offline Operations — Field Submissions</div>
            <div style={{display:"flex",alignItems:"baseline",gap:20,marginBottom:12}}>
              <span style={{fontFamily:"'JetBrains Mono'",fontSize:38,fontWeight:700}}>{total}</span>
              <span style={{fontSize:14,opacity:.6}}>total submissions</span>
            </div>
            <div style={{display:"flex",gap:20}}>
              <div><div style={{fontSize:9,opacity:.5}}>SYNCED</div><div className="m" style={{fontSize:18,color:"#7FBF96"}}>{synced}</div></div>
              <div><div style={{fontSize:9,opacity:.5}}>PENDING</div><div className="m" style={{fontSize:18,color:"#F5DDB8"}}>{pending}</div></div>
              <div><div style={{fontSize:9,opacity:.5}}>ERRORS</div><div className="m" style={{fontSize:18,color:errors>0?"#F5C4C4":"rgba(255,255,255,.4)"}}>{errors}</div></div>
              <div style={{marginLeft:"auto"}}><div style={{fontSize:9,opacity:.5}}>PROCURED</div><div className="m" style={{fontSize:18}}>{fK(totalNet)}</div></div>
              <div><div style={{fontSize:9,opacity:.5}}>IN TRANSIT</div><div className="m" style={{fontSize:18,color:inTransit.length>0?"#F5DDB8":"rgba(255,255,255,.4)"}}>{inTransit.length}</div></div>
              <div><div style={{fontSize:9,opacity:.5}}>TRANSFERRED</div><div className="m" style={{fontSize:18}}>{fK(totalTrf)}</div></div>
              <div><div style={{fontSize:9,opacity:.5}}>PRESSED</div><div className="m" style={{fontSize:18}}>{fK(totalOut)}</div></div>
            </div>
          </div>

          {/* Pipeline cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:16}}>
            {[[ICON_PROCUREMENT,"Procurement",pRcv.length,fK(totalNet),pRcv.filter(r=>r.sync==="synced").length,"#2D5A3D","rcv"],[null,"Double Press Quality",pQc.length,pQc.filter(q=>q.verdict==="Approved").length+" approved",pQc.filter(r=>r.sync==="synced").length,"#4A7C59","qc"],[ICON_PRESSING,"Pressing Shifts",pDpr.length,fK(totalOut)+" output",pDpr.filter(r=>r.sync==="synced").length,"#C0714A","dpr"],[ICON_TRANSFER,"Transfers",pTrf.length,inTransit.length>0?inTransit.length+" in transit":"All delivered",pTrf.filter(r=>r.sync==="synced").length,"#475577","trf"]].map(([ic,l,ct,sub,sy,col,nav])=>(<div className="sc" key={l} style={{cursor:"pointer",borderColor:col+"40"}} onClick={()=>setPg(nav)}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div style={{width:40,height:40,borderRadius:10,background:col+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{ic ? <ImgIcon src={ic} size={24} /> : "🔍"}</div>
                <div className="m" style={{fontSize:24,color:col}}>{ct}</div>
              </div>
              <div style={{fontSize:14,fontWeight:700,color:"#2C3E50"}}>{l}</div>
              <div style={{fontSize:10,color:"#95A09C",marginTop:2}}>{sub}</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
                {br(sy,ct,col,4)}
                <span style={{fontSize:9,color:"#95A09C",marginLeft:8,whiteSpace:"nowrap"}}>{sy}/{ct} synced</span>
              </div>
            </div>))}
          </div>

          {/* Recent submissions */}
          <div className="xc"><div className="xh"><h3>🕐 Recent Submissions</h3><span className="ct">{total}</span></div>
            <table className="t"><thead><tr><th>ID</th><th>Type</th><th>Detail</th><th>Site</th><th>Quantity</th><th>Sync</th><th>Date</th></tr></thead><tbody>
              {[...pRcv.map(r=>({...r,_t:"rcv",_img:ICON_PROCUREMENT,_det:r.supplier+" · "+r.commodity,_qty:fK(r.net)})),...pQc.map(r=>({...r,_t:"qc",_img:null,_emoji:"🔍",_det:(r.type==="received"?"Received":"Press")+" · "+r.commodity,_qty:r.finalGrade})),...pDpr.map(r=>({...r,_t:"dpr",_img:ICON_PRESSING,_det:r.line+" · "+r.commodity,_qty:r.outBales+" bales"}))].sort((a,b)=>b.date>a.date?1:-1).slice(0,8).map(r=>(<tr key={r.id+r._t} onClick={()=>openDet(r,r._t)}>
                <td className="m" style={{color:"#2D5A3D",fontSize:10}}>{r.id}</td>
                <td>{r._img ? <ImgIcon src={r._img} size={16} /> : <span style={{fontSize:13}}>{r._emoji||"🔍"}</span>}</td>
                <td style={{fontSize:10,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r._det}</td>
                <td>{siteBd(r.site)}</td>
                <td className="m" style={{fontSize:11}}>{r._qty}</td>
                <td>{bd(r.sync)}</td>
                <td className="m" style={{fontSize:10,color:"#95A09C"}}>{r.date}</td>
              </tr>))}
            </tbody></table>
          </div>
        </div>}

        {/* ═══ PROCUREMENT ═══ */}
        {!isLoadingData&&pg==="rcv"&&<div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 110px)",overflow:"hidden"}}>
          <div style={{padding:"18px 18px 14px"}}><div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:14}}>
            <div className="sc"><div className="sl">Receipts</div><div className="sv" style={{fontSize:16}}>{pRcv.length}</div></div>
            <div className="sc"><div className="sl">Total Procured</div><div className="sv" style={{fontSize:16}}>{fK(totalNet)}</div></div>
            <div className="sc" style={{borderColor:"#F5DDB840"}}><div className="sl" style={{color:"#D4960A"}}>🚛 Shipped</div><div className="sv" style={{fontSize:16,color:"#D4960A"}}>{pRcv.filter(r=>r.stage==="shipped").length}</div><div className="ss">awaiting receipt</div></div>
            <div className="sc"><div className="sl">📦 Received</div><div className="sv" style={{fontSize:16,color:"#4A7C59"}}>{pRcv.filter(r=>r.stage==="received").length}</div><div className="ss">pending QC</div></div>
            <div className="sc"><div className="sl">✅ QC Done</div><div className="sv" style={{fontSize:16}}>{pRcv.filter(r=>r.stage==="qc_done").length}</div><div className="ss">fully processed</div></div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <input value={sr} onChange={e=>setSr(e.target.value)} placeholder="Search supplier, ID..." style={{width:220,height:34,padding:"0 12px",border:"1px solid #E4E1DC",borderRadius:7,fontFamily:"inherit",fontSize:12,outline:"none"}}/>
            <div style={{display:"flex",gap:4}}>{[["all","All Stages"],["shipped","🚛 Shipped"],["received","📦 Received"],["qc_done","✅ QC Done"]].map(([k,l])=>pl(l,rcvStg===k,()=>setRcvStg(k)))}</div>
            <div style={{display:"flex",gap:4}}>{[["all","All Sync"],["synced","Synced"],["pending","Pending"],["error","Errors"]].map(([k,l])=>pl(l,syncF===k,()=>setSyncF(k)))}</div>
            <div style={{marginLeft:"auto",display:"flex",gap:4}}>{["All","Sokhna","Dakhla"].map(s=>pl(s,siteF===s,()=>setSiteF(s)))}</div>
          </div>
          </div>
          <div style={{flex:1,overflow:"auto",minHeight:0,padding:"0 18px 18px"}}>
          <div className="xc"><div className="xh" style={{background:"#2D5A3D"}}><h3><ImgIcon src={ICON_PROCUREMENT} size={18} /> Procurement Receipts</h3><button onClick={()=>{setPg("incoming");setSr("");setSel(null);setSelType(null);}} style={{padding:"4px 10px",borderRadius:6,background:"rgba(255,255,255,.25)",color:"#fff",border:"none",fontSize:9,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginRight:8}}>Full View →</button><span className="ct">{fRcv.length}</span></div>
            <table className="t"><thead><tr><th>ID</th><th>Supplier</th><th>Commodity</th><th>Grade</th><th>Stage</th><th>Vehicle / Plate</th><th>Net Weight</th><th>Bales</th><th>Price</th><th>Site</th><th>PO Status</th><th>Sync</th><th>Date</th></tr></thead><tbody>
              {fRcv.map(r=>{const lpo=getLinkedPo(r);return(<tr key={r.id} onClick={()=>openDet(r,"rcv")} style={{background:sel&&sel.id===r.id?"#E4EFE6":""}}>
                <td className="m" style={{color:"#2D5A3D",fontSize:10}}>{r.id}</td>
                <td style={{fontWeight:500}}>{r.supplier}</td>
                <td style={{fontSize:10}}>{r.commodity}</td>
                <td>{bd("synced",r.grade)}</td>
                <td>{rcvStage(r.stage)}</td>
                <td className="m" style={{fontSize:9,color:"#64706C"}}>{r.plate}</td>
                <td className="m" style={{color:"#2D5A3D"}}>{fK(r.net)}</td>
                <td className="m" style={{fontSize:10}}>{r.bales}</td>
                <td className="m" style={{fontSize:10}}>{r.price}</td>
                <td>{siteBd(r.site)}</td>
                <td><div style={{display:"flex",flexDirection:"column",gap:2}}>{lpo?<><span style={{display:"inline-flex",alignItems:"center",gap:3,padding:"2px 7px",borderRadius:99,background:"#dcfce7",color:"#166534",fontSize:9,fontWeight:700,whiteSpace:"nowrap"}}>✓ {lpo.poName}</span>{(()=>{const rcpt=getLinkedReceipt(r);return rcpt?<span style={{display:"inline-flex",alignItems:"center",gap:3,padding:"2px 7px",borderRadius:99,background:"#e0f2fe",color:"#0e7490",fontSize:8,fontWeight:600,whiteSpace:"nowrap"}}>Receipt: {rcpt}</span>:null;})()}</>:<span style={{display:"inline-flex",padding:"2px 7px",borderRadius:99,background:"#F2F0EC",color:"#95A09C",fontSize:9,fontWeight:600}}>Pending</span>}</div></td>
                <td>{bd(r.sync)}</td>
                <td className="m" style={{fontSize:10,color:"#95A09C"}}>{r.date}</td>
              </tr>);})}
              {fRcv.length===0&&<tr><td colSpan={13} style={{textAlign:"center",padding:24,color:"#95A09C",fontSize:12}}>No procurement receipts match the current filters</td></tr>}
            </tbody></table>
          </div>
          </div>
        </div>}

        {/* ═══ QUALITY ═══ */}
        {!isLoadingData&&pg==="qc"&&<div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 110px)",overflow:"hidden"}}>
          <div style={{padding:"18px 18px 14px"}}><div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:14}}>
            <div className="sc"><div className="sl">Double Press QC</div><div className="sv" style={{fontSize:16}}>{pQc.length}</div></div>
            <div className="sc"><div className="sl">Approved</div><div className="sv" style={{fontSize:16,color:"#2D5A3D"}}>{pQc.filter(q=>q.verdict==="Approved").length}</div></div>
            <div className="sc"><div className="sl">Rejected</div><div className="sv" style={{fontSize:16,color:"#C94444"}}>{pQc.filter(q=>q.verdict==="Rejected").length}</div></div>
            <div className="sc"><div className="sl">Pending Review</div><div className="sv" style={{fontSize:16}}>{pQc.filter(q=>q.verdict!=="Approved"&&q.verdict!=="Rejected").length}</div></div>
            <div className="sc"><div className="sl">Total Reports</div><div className="sv" style={{fontSize:16}}>{pQc.length}</div></div>
          </div>
          <div style={{display:"flex",gap:6,marginBottom:14,alignItems:"center"}}>
            <input value={sr} onChange={e=>setSr(e.target.value)} placeholder="Search..." style={{width:220,height:34,padding:"0 12px",border:"1px solid #E4E1DC",borderRadius:7,fontFamily:"inherit",fontSize:12,outline:"none"}}/>
            <div style={{display:"flex",gap:4}}></div>
            <div style={{display:"flex",gap:4}}>{["All","Sokhna","Dakhla"].map(s=>pl(s,siteF===s,()=>setSiteF(s)))}</div>
            <div style={{marginLeft:"auto",display:"flex",gap:4}}>{[["all","All"],["synced","Synced"],["pending","Pending"]].map(([k,l])=>pl(l,syncF===k,()=>setSyncF(k)))}</div>
          </div></div>
          <div style={{flex:1,overflow:"auto",minHeight:0,padding:"0 18px 18px"}}>
          <div className="xc"><div className="xh" style={{background:"#4A7C59"}}><h3>🔍 Double Press Quality Reports</h3><span className="ct">{fQc.length}</span></div>
            <table className="t"><thead><tr><th>ID</th><th>Site</th><th>Source</th><th>Commodity</th><th>Grade → Final</th><th>Moisture</th><th>Verdict</th><th>Bales (G1/G2/Mix)</th><th>Sync</th><th>Date</th></tr></thead><tbody>
              {fQc.map(r=>(<tr key={r.id} onClick={()=>openDet(r,"qc")} style={{background:sel&&sel.id===r.id?"#E4EFE6":""}}>
                <td className="m" style={{color:"#4A7C59",fontSize:10}}>{r.id}</td>
                
                <td>{siteBd(r.site)}</td>
                <td className="m" style={{fontSize:10,color:"#64706C"}}>{r.ref}</td>
                <td style={{fontSize:10}}>{r.commodity}</td>
                <td style={{fontSize:10}}>{r.grade} → <strong>{r.finalGrade}</strong></td>
                <td className="m" style={{fontSize:10,color:parseFloat(r.moisture)>13?"#D4960A":"#2D5A3D"}}>{r.moisture}</td>
                <td>{bd(r.verdict==="Approved"?"synced":"error",r.verdict)}</td>
                <td className="m" style={{fontSize:10}}>{r.g1}/{r.g2}/{r.mix}</td>
                <td>{bd(r.sync)}</td>
                <td className="m" style={{fontSize:10,color:"#95A09C"}}>{r.date}</td>
              </tr>))}
              {fQc.length===0&&<tr><td colSpan={11} style={{textAlign:"center",padding:24,color:"#95A09C",fontSize:12}}>No quality assessments match the current filters</td></tr>}
            </tbody></table>
          </div>
          </div>
        </div>}

        {/* ═══ PRESS OPS ═══ */}
        {!isLoadingData&&pg==="dpr"&&<div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 110px)",overflow:"hidden"}}>
          <div style={{padding:"18px 18px 14px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:14}}>
            <div className="sc"><div className="sl">Batches</div><div className="sv" style={{fontSize:18}}>{pDpr.length}</div></div>
            <div className="sc"><div className="sl">Output</div><div className="sv" style={{fontSize:18}}>{fK(totalOut)}</div></div>
            <div className="sc"><div className="sl">Output Bales</div><div className="sv" style={{fontSize:18}}>{pDpr.reduce((s,r)=>s+r.outBales,0)}</div></div>
            <div className="sc"><div className="sl">Avg Fuel</div><div className="sv" style={{fontSize:18}}>{pDpr.length>0?Math.round(pDpr.reduce((s,r)=>s+r.fuel,0)/pDpr.length):0} L</div></div>
            <div className="sc"><div className="sl">Synced</div><div className="sv" style={{fontSize:18}}>{pDpr.filter(r=>r.sync==="synced").length}/{pDpr.length}</div></div>
          </div>
          <div style={{display:"flex",gap:6,marginBottom:14,alignItems:"center"}}>
            <input value={sr} onChange={e=>setSr(e.target.value)} placeholder="Search batch, operator..." style={{width:240,height:36,padding:"0 14px",border:"1px solid #D5D0C8",borderRadius:8,fontFamily:"'DM Sans',system-ui,sans-serif",fontSize:12,color:"#2C3E50",background:"#fff"}}/>
            <div style={{display:"flex",gap:4}}>{[["all","All"],["synced","Synced"],["processing","Processing"],["pending","Pending"]].map(([k,l])=>pl(l,syncF===k,()=>setSyncF(k)))}</div>
            <div style={{marginLeft:"auto",display:"flex",gap:4}}>{["All","Sokhna","Dakhla"].map(s=>pl(s,siteF===s,()=>setSiteF(s)))}</div>
          </div>
          </div>
          <div style={{flex:1,overflow:"auto",minHeight:0,padding:"0 18px 18px"}}>
          <div className="xc"><div className="xh" style={{background:"#C0714A"}}><h3><ImgIcon src={ICON_PRESSING} size={18} /> Pressing Shifts</h3><span className="ct">{fDpr.length}</span></div>
            <table className="t"><thead><tr><th>ID</th><th>Batch</th><th>Site</th><th>Line</th><th>Operator</th><th>Commodity</th><th>In</th><th>Out</th><th>Bales</th><th>Fuel</th><th>MO Status</th><th>Sync</th><th>Date</th></tr></thead><tbody>
              {fDpr.map(r=>{const lmo=getLinkedMo(r);return(<tr key={r.id} onClick={()=>openDet(r,"dpr")} style={{background:sel&&sel.id===r.id?"#E4EFE6":""}}>
                <td className="m" style={{color:"#C0714A",fontSize:10}}>{r.id}</td>
                <td className="m" style={{fontSize:10}}>{r.batch}</td>
                <td>{siteBd(r.site)}</td>
                <td>{bd(r.line==="Press 1"?"synced":"pending",r.line)}</td>
                <td style={{fontSize:10}}>{r.operator}</td>
                <td style={{fontSize:10}}>{r.commodity}</td>
                <td className="m" style={{fontSize:10}}>{fK(r.inWeight)}</td>
                <td className="m" style={{fontSize:10,color:"#2D5A3D"}}>{fK(r.outWeight)}</td>
                <td className="m" style={{fontSize:10}}>{r.outBales}</td>
                <td className="m" style={{fontSize:10}}>{r.fuel}L</td>
                <td>{lmo?<span style={{display:"inline-flex",alignItems:"center",gap:3,padding:"2px 7px",borderRadius:99,background:"#dcfce7",color:"#166534",fontSize:9,fontWeight:700,whiteSpace:"nowrap"}}>✓ {lmo.moName}</span>:<span style={{display:"inline-flex",padding:"2px 7px",borderRadius:99,background:"#F2F0EC",color:"#95A09C",fontSize:9,fontWeight:600}}>Pending</span>}</td>
                <td>{bd(r.sync)}</td>
                <td className="m" style={{fontSize:10,color:"#95A09C"}}>{r.date}</td>
              </tr>);})}
              {fDpr.length===0&&<tr><td colSpan={13} style={{textAlign:"center",padding:24,color:"#95A09C",fontSize:12}}>No pressing shifts match the current filters</td></tr>}
            </tbody></table>
          </div>
          </div>
        </div>}

        {/* ═══ TRANSFERS ═══ */}
        {!isLoadingData&&pg==="trf"&&<div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 110px)",overflow:"hidden"}}>
          <div style={{padding:"18px 18px 14px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:14}}>
            <div className="sc"><div className="sl">Total Transfers</div><div className="sv" style={{fontSize:18}}>{pTrf.length}</div></div>
            <div className="sc"><div className="sl">Total Shipped</div><div className="sv" style={{fontSize:18}}>{fK(totalTrf)}</div></div>
            <div className="sc" style={{borderColor:inTransit.length>0?"#F5DDB8":"#CDDDD1"}}><div className="sl" style={{color:"#D4960A"}}>In Transit</div><div className="sv" style={{fontSize:18,color:inTransit.length>0?"#D4960A":"#2D5A3D"}}>{inTransit.length}</div><div className="ss">{inTransit.length>0?fK(inTransit.reduce((s,r)=>s+r.weight,0))+" on road":"all delivered"}</div></div>
            <div className="sc"><div className="sl">Transit Loss</div><div className="sv" style={{fontSize:18,color:totalLoss>0?"#C94444":"#2D5A3D"}}>{totalLoss>0?fK(totalLoss):"0"}</div><div className="ss">{totalLoss>0?((totalLoss/totalTrf)*100).toFixed(2)+"% loss":"no loss"}</div></div>
            <div className="sc"><div className="sl">Avg Load</div><div className="sv" style={{fontSize:18}}>{pTrf.length>0?fK(Math.round(totalTrf/pTrf.length)):"—"}</div><div className="ss">per truck</div></div>
          </div>

          {/* In-transit alert */}
          {inTransit.length>0&&<div style={{padding:12,background:"#FDF6EC",borderRadius:9,border:"1px solid #F5DDB8",marginBottom:14}}>
            {inTransit.map(r=>(<div key={r.id} style={{display:"flex",alignItems:"center",gap:12,padding:"6px 0"}}>
              <span style={{fontSize:16}}>🚛</span>
              <div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:6}}><span className="m" style={{fontSize:12,color:"#D4960A"}}>{r.id}</span><span style={{fontSize:10,color:"#64706C"}}>{fK(r.weight)} · {r.bales} bales · {r.commodity}</span></div><div style={{fontSize:10,color:"#D4960A",marginTop:2}}>ETA: {r.eta} · {r.crew?.[0]?.ppl?.[0] || "—"} · Plate: {r.plate}</div></div>
              <span style={{display:"inline-flex",padding:"3px 10px",borderRadius:99,fontSize:10,fontWeight:600,background:"#D4960A",color:"#fff"}}>In Transit</span>
            </div>))}
          </div>}

          <div style={{display:"flex",gap:6,marginBottom:14,alignItems:"center"}}>
            <input value={sr} onChange={e=>setSr(e.target.value)} placeholder="Search ID, driver..." style={{width:240,height:36,padding:"0 14px",border:"1px solid #D5D0C8",borderRadius:8,fontFamily:"'DM Sans',system-ui,sans-serif",fontSize:12,color:"#2C3E50",background:"#fff"}}/>
            <div style={{display:"flex",gap:4}}>{[["all","All"],["in_transit","In Transit"],["delivered","Delivered"],["received","Received"]].map(([k,l])=>pl(l,trfSt===k,()=>setTrfSt(k)))}</div>

          </div>
          </div>
          <div style={{flex:1,overflow:"auto",minHeight:0,padding:"0 18px 18px"}}>
          <div className="xc"><div className="xh" style={{background:"#475577"}}><h3><ImgIcon src={ICON_TRANSFER} size={18} /> Dakhla → Sokhna Transfers</h3><span className="ct">{fTrf.length}</span></div>
            <table className="t"><thead><tr><th>ID</th><th>Commodity</th><th>Grade</th><th>Bales</th><th>Weight</th><th>Truck / Plate</th><th>Driver</th><th>Seal</th><th>Load Date</th><th>Arrival</th><th>Rcv Weight</th><th>Status</th></tr></thead><tbody>
              {fTrf.map(r=>{const st=TRS[r.status]||TRS.in_transit;return(<tr key={r.id} onClick={()=>openDet(r,"trf")} style={{background:sel&&sel.id===r.id?"#E4EFE6":""}}>
                <td className="m" style={{color:"#475577",fontSize:10}}>{r.id}</td>
                <td style={{fontSize:10}}>{r.commodity}</td>
                <td>{bd("synced",r.grade)}</td>
                <td className="m" style={{fontSize:10}}>{r.bales}</td>
                <td className="m" style={{color:"#2D5A3D"}}>{fK(r.weight)}</td>
                <td style={{fontSize:9,color:"#64706C"}}>{r.truck}<br/><span className="m">{r.plate}</span></td>
                <td style={{fontSize:10}}>{r.crew?.[0]?.ppl?.[0] || "—"}</td>
                <td className="m" style={{fontSize:9,color:"#64706C"}}>{r.seal}</td>
                <td className="m" style={{fontSize:10,color:"#95A09C"}}>{r.loadDate}</td>
                <td className="m" style={{fontSize:10,color:r.arrDate?"#2D5A3D":"#D4960A"}}>{r.arrDate||"—"}</td>
                <td className="m" style={{fontSize:10,color:r.diff?"#C94444":"#B0BAB6"}}>{r.rcvWeight?fK(r.rcvWeight)+(r.diff?" ("+r.diff+")":""):"—"}</td>
                <td><span style={{display:"inline-flex",padding:"2px 10px",borderRadius:99,fontSize:10,fontWeight:600,background:st.bg,color:st.c,whiteSpace:"nowrap"}}>{st.l}</span></td>
              </tr>);})}
              {fTrf.length===0&&<tr><td colSpan={12} style={{textAlign:"center",padding:24,color:"#95A09C",fontSize:12}}>No transfers match the current filters</td></tr>}
            </tbody></table>
          </div>
         </div>
         </div>}


          {/* ═══ DETAIL PANEL ═══ */}
          {sel&&<div className="dp">
            <div style={{position:"sticky",top:0,background:"#FAFAF8",zIndex:5,borderBottom:"1.5px solid #E8E5E0"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px 10px"}}>
                <div>
                  <div className="m" style={{fontSize:16,color:"#2D5A3D"}}>{sel.id}</div>
                  <div style={{fontSize:11,color:"#95A09C",marginTop:2}}>{selType==="rcv"?sel.supplier+" · "+sel.commodity+" · "+(sel.site||""):selType==="qc"?(sel.type==="received"?"Received":"Press")+" · "+sel.commodity+" · "+(sel.site||""):selType==="dpr"?sel.line+" · "+sel.commodity+" · "+(sel.site||""):sel.from+" → "+sel.to+" · "+sel.commodity}</div>
                </div>
                <button onClick={()=>{setSel(null);setSelType(null);}} style={{width:28,height:28,borderRadius:8,border:"1px solid #E8E5E0",background:"#fff",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
              </div>

              {/* Quick stats */}
              <div style={{display:"flex",gap:8,padding:"0 18px 12px",flexWrap:"wrap"}}>
                {selType==="rcv"&&<><div style={{padding:"6px 14px",borderRadius:8,background:"#E4EFE6",border:"1px solid #D5E5D5"}}><div className="m" style={{fontSize:14,color:"#2D5A3D"}}>{fK(sel.net)}</div><div style={{fontSize:8,color:"#95A09C",marginTop:1}}>Net Weight</div></div>
                <div style={{padding:"6px 14px",borderRadius:8,background:"#E4EFE6",border:"1px solid #D5E5D5"}}><div className="m" style={{fontSize:14,color:"#2D5A3D"}}>{sel.bales}</div><div style={{fontSize:8,color:"#95A09C",marginTop:1}}>Bales</div></div>
                <div style={{padding:"6px 14px",borderRadius:8,background:"#E4EFE6",border:"1px solid #D5E5D5"}}><div className="m" style={{fontSize:14,color:"#2D5A3D"}}>{sel.grade||"—"}</div><div style={{fontSize:8,color:"#95A09C",marginTop:1}}>Grade</div></div>
                {sel.hasQc&&<div style={{padding:"6px 14px",borderRadius:8,background:sel.qcData?.verdict==="Approved"?"#E4EFE6":"#FDF0F0",border:"1px solid "+(sel.qcData?.verdict==="Approved"?"#D5E5D5":"#F5C4C4")}}><div className="m" style={{fontSize:14,color:sel.qcData?.verdict==="Approved"?"#2D5A3D":"#C94444"}}>{sel.qcData?.verdict||"—"}</div><div style={{fontSize:8,color:"#95A09C",marginTop:1}}>QC Verdict</div></div>}</>}
                {selType==="qc"&&<><div style={{padding:"6px 14px",borderRadius:8,background:"#E4EFE6",border:"1px solid #D5E5D5"}}><div className="m" style={{fontSize:14,color:"#2D5A3D"}}>{sel.finalGrade}</div><div style={{fontSize:8,color:"#95A09C",marginTop:1}}>Grade</div></div>
                <div style={{padding:"6px 14px",borderRadius:8,background:sel.verdict==="Approved"?"#E4EFE6":"#FDF0F0",border:"1px solid "+(sel.verdict==="Approved"?"#D5E5D5":"#F5C4C4")}}><div className="m" style={{fontSize:14,color:sel.verdict==="Approved"?"#2D5A3D":"#C94444"}}>{sel.verdict}</div><div style={{fontSize:8,color:"#95A09C",marginTop:1}}>Verdict</div></div>
                <div style={{padding:"6px 14px",borderRadius:8,background:"#E4EFE6",border:"1px solid #D5E5D5"}}><div className="m" style={{fontSize:14,color:"#2D5A3D"}}>{sel.moisture||"—"}</div><div style={{fontSize:8,color:"#95A09C",marginTop:1}}>Moisture</div></div></>}
                {selType==="dpr"&&<><div style={{padding:"6px 14px",borderRadius:8,background:"#FDF6EC",border:"1px solid #F5DDB8"}}><div className="m" style={{fontSize:14,color:"#C0714A"}}>{sel.outBales}</div><div style={{fontSize:8,color:"#95A09C",marginTop:1}}>Output Bales</div></div>
                <div style={{padding:"6px 14px",borderRadius:8,background:"#FDF6EC",border:"1px solid #F5DDB8"}}><div className="m" style={{fontSize:14,color:"#C0714A"}}>{fK(sel.outWeight)}</div><div style={{fontSize:8,color:"#95A09C",marginTop:1}}>Output Weight</div></div>
                <div style={{padding:"6px 14px",borderRadius:8,background:"#E4EFE6",border:"1px solid #D5E5D5"}}><div className="m" style={{fontSize:14,color:"#2D5A3D"}}>{sel.outAvgBale} kg</div><div style={{fontSize:8,color:"#95A09C",marginTop:1}}>Avg Bale</div></div></>}
                {selType==="trf"&&<><div style={{padding:"6px 14px",borderRadius:8,background:"#E4EFE6",border:"1px solid #D5E5D5"}}><div className="m" style={{fontSize:14,color:"#2D5A3D"}}>{sel.bales}</div><div style={{fontSize:8,color:"#95A09C",marginTop:1}}>Bales</div></div>
                <div style={{padding:"6px 14px",borderRadius:8,background:"#E4EFE6",border:"1px solid #D5E5D5"}}><div className="m" style={{fontSize:14,color:"#2D5A3D"}}>{fK(sel.weight)}</div><div style={{fontSize:8,color:"#95A09C",marginTop:1}}>Weight</div></div>
                <div style={{padding:"6px 14px",borderRadius:8,background:"#E4EFE6",border:"1px solid #D5E5D5"}}><div className="m" style={{fontSize:14,color:"#2D5A3D"}}>{sel.plate}</div><div style={{fontSize:8,color:"#95A09C",marginTop:1}}>Plate</div></div></>}
              </div>

              {/* Tabs */}
              <div style={{display:"flex",gap:0,borderBottom:"1.5px solid #E8E5E0",padding:"0 18px"}}>
                {(selType==="rcv"?["Overview","Crew","Attachments"]:selType==="qc"?["Grades","Details"]:selType==="dpr"?["Overview","Crew","Attachments"]:["Overview","Crew","Attachments"]).map((t,i)=><button key={t} onClick={()=>setDetTab(i)} style={{padding:"8px 14px",fontSize:11,fontWeight:detTab===i?700:500,color:detTab===i?"#2D5A3D":"#95A09C",background:"none",border:"none",borderBottom:detTab===i?"2px solid #2D5A3D":"2px solid transparent",cursor:"pointer",fontFamily:"inherit"}}>{t}</button>)}
              </div>
            </div>

            <div style={{padding:"16px 18px"}}>
              {/* RCV Overview */}
              {selType==="rcv"&&detTab===0&&<div>
                <div style={{fontSize:11,fontWeight:700,color:"#2D5A3D",marginBottom:10}}>SHIPMENT DETAILS</div>
                {[["Supplier",sel.supplier],["Commodity",sel.commodity],["Vehicle / Plate",sel.plate],["Driver",sel.driver],["Net Weight",fK(sel.net)],["Gross",fK(sel.gross)],["Tare",fK(sel.tare)],["Bales",""+sel.bales],["Price",""+sel.price],["Site",sel.site],["Grade",sel.grade||"—"],["Date",sel.date],["Time",sel.time||"—"],["Created By",sel.createdBy||"—"],["Sync",sel.sync]].map(([l,v])=><div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #F2F0EC"}}><span style={{fontSize:11,color:"#95A09C"}}>{l}</span><span className="m" style={{fontSize:11,color:"#2C3E50"}}>{v}</span></div>)}
                {sel.hasQc&&<div style={{marginTop:16}}><div style={{fontSize:11,fontWeight:700,color:"#4A7C59",marginBottom:10}}>QUALITY ASSESSMENT</div>
                  {[["Inspector",sel.qcData?.inspector||"—"],["Verdict",sel.qcData?.verdict||"—"],["Final Grade",sel.qcData?.finalGrade||"—"],["Moisture",sel.qcData?.moisture||"—"],["G1 Bales",""+sel.qcData?.g1],["G2 Bales",""+sel.qcData?.g2],["Mix",""+sel.qcData?.mix],["Notes",sel.qcData?.notes||"—"]].map(([l,v])=><div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #F2F0EC"}}><span style={{fontSize:11,color:"#95A09C"}}>{l}</span><span className="m" style={{fontSize:11,color:"#2C3E50"}}>{v}</span></div>)}
                </div>}
              </div>}

              {/* RCV Crew */}
              {selType==="rcv"&&detTab===1&&<div>
                <div style={{fontSize:11,fontWeight:700,color:"#2D5A3D",marginBottom:10}}>CREW & PERSONNEL</div>
                {(sel.crew||[]).map((g,i)=><div key={i} style={{marginBottom:14}}><div style={{fontSize:10,fontWeight:700,color:"#95A09C",marginBottom:6}}>{g.role}</div>{g.ppl.map((p,j)=><div key={j} style={{fontSize:12,padding:"4px 0",color:"#2C3E50"}}>{p}</div>)}</div>)}
                {(!sel.crew||sel.crew.length===0)&&<div style={{color:"#95A09C",fontSize:11}}>No crew data available</div>}
              </div>}

              {/* RCV/DPR/TRF Attachments */}
              {((selType==="rcv"&&detTab===2)||(selType==="dpr"&&detTab===2)||(selType==="trf"&&detTab===2))&&<div>
                <div style={{fontSize:11,fontWeight:700,color:"#2D5A3D",marginBottom:10}}>ATTACHMENTS</div>
                {(sel.att||sel.attachments||[]).map((a,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #F2F0EC"}}>
                  <div style={{width:32,height:32,borderRadius:6,background:"#E4EFE6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>{a.t==="photo"?"📸":"📄"}</div>
                  <div><div style={{fontSize:11,fontWeight:600,color:"#2C3E50"}}>{a.n}</div><div style={{fontSize:9,color:"#95A09C"}}>{a.t} · {a.s}</div></div>
                </div>)}
                {(!(sel.att||sel.attachments)||((sel.att||sel.attachments||[]).length===0))&&<div style={{color:"#95A09C",fontSize:11}}>No attachments available</div>}
              </div>}

              {/* QC Grades tab */}
              {selType==="qc"&&detTab===0&&<div>
                <div style={{fontSize:11,fontWeight:700,color:"#4A7C59",marginBottom:10}}>GRADE BREAKDOWN</div>
                {[["G1 Bales",""+sel.g1],["G2 Bales",""+sel.g2],["Mix",""+sel.mix],["No Grade",""+sel.noGrade],["Final Grade",sel.finalGrade],["Verdict",sel.verdict],["Moisture",sel.moisture||"—"]].map(([l,v])=><div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #F2F0EC"}}><span style={{fontSize:11,color:"#95A09C"}}>{l}</span><span className="m" style={{fontSize:11,color:"#2C3E50"}}>{v}</span></div>)}
              </div>}

              {/* QC Details tab */}
              {selType==="qc"&&detTab===1&&<div>
                <div style={{fontSize:11,fontWeight:700,color:"#4A7C59",marginBottom:10}}>INSPECTION DETAILS</div>
                {[["Reference",sel.ref],["Type",sel.type],["Inspector",sel.inspector],["Supplier",sel.supplier],["Commodity",sel.commodity],["Site",sel.site],["Net Weight",sel.netWeight?fK(sel.netWeight):"—"],["Bales",""+sel.bales],["Date",sel.date],["Sync",sel.sync]].map(([l,v])=><div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #F2F0EC"}}><span style={{fontSize:11,color:"#95A09C"}}>{l}</span><span className="m" style={{fontSize:11,color:"#2C3E50"}}>{v}</span></div>)}
              </div>}

              {/* DPR Overview */}
              {selType==="dpr"&&detTab===0&&<div>
                <div style={{fontSize:11,fontWeight:700,color:"#C0714A",marginBottom:10}}>PRESSING DETAILS</div>
                {[["Press Line",sel.line],["Batch",sel.batch],["Operator",sel.operator],["Shift",sel.shift],["Commodity",sel.commodity],["Input Bales",""+sel.inBales],["Input Weight",fK(sel.inWeight)],["Input Grade",sel.inGrade],["Output Bales",""+sel.outBales],["Output Weight",fK(sel.outWeight)],["Avg Bale",sel.outAvgBale+" kg"],["Density",sel.density],["Start",sel.startTime],["End",sel.endTime],["Fuel",sel.fuel+" L"],["Oil Temp",sel.oilTemp],["Oil Pressure",sel.oilPressure],["Sources",sel.sources],["Date",sel.date],["Sync",sel.sync]].map(([l,v])=><div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #F2F0EC"}}><span style={{fontSize:11,color:"#95A09C"}}>{l}</span><span className="m" style={{fontSize:11,color:"#2C3E50"}}>{v}</span></div>)}
              </div>}

              {/* DPR Crew */}
              {selType==="dpr"&&detTab===1&&<div>
                <div style={{fontSize:11,fontWeight:700,color:"#C0714A",marginBottom:10}}>CREW & PERSONNEL</div>
                {(sel.crew||[]).map((g,i)=><div key={i} style={{marginBottom:14}}><div style={{fontSize:10,fontWeight:700,color:"#95A09C",marginBottom:6}}>{g.role}</div>{g.ppl.map((p,j)=><div key={j} style={{fontSize:12,padding:"4px 0",color:"#2C3E50"}}>{p}</div>)}</div>)}
              </div>}

              {/* TRF Overview */}
              {selType==="trf"&&detTab===0&&<div>
                <div style={{fontSize:11,fontWeight:700,color:"#475577",marginBottom:10}}>TRANSFER DETAILS</div>
                {[["From",sel.from],["To",sel.to],["Commodity",sel.commodity],["Grade",sel.grade],["Press",sel.press],["Bales",""+sel.bales],["Weight",fK(sel.weight)],["Tare",fK(sel.tare)],["Plate",sel.plate],["Truck",sel.truck],["Seal",sel.seal],["Load Date",sel.loadDate],["Load Time",sel.loadTime],["ETA",sel.eta],["Arrival Date",sel.arrDate||"—"],["Arrival Time",sel.arrTime||"—"],["Condition",sel.condition||"—"],["Rcv Weight",sel.rcvWeight?fK(sel.rcvWeight):"—"],["Difference",sel.diff?fK(sel.diff):"—"],["Distance",sel.distance],["Freight",""+sel.freight],["Status",sel.status],["Sync",sel.sync]].map(([l,v])=><div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #F2F0EC"}}><span style={{fontSize:11,color:"#95A09C"}}>{l}</span><span className="m" style={{fontSize:11,color:"#2C3E50"}}>{v}</span></div>)}
              </div>}

              {/* TRF Crew */}
              {selType==="trf"&&detTab===1&&<div>
                <div style={{fontSize:11,fontWeight:700,color:"#475577",marginBottom:10}}>CREW & PERSONNEL</div>
                {(sel.crew||[]).map((g,i)=><div key={i} style={{marginBottom:14}}><div style={{fontSize:10,fontWeight:700,color:"#95A09C",marginBottom:6}}>{g.role}</div>{g.ppl.map((p,j)=><div key={j} style={{fontSize:12,padding:"4px 0",color:"#2C3E50"}}>{p}</div>)}</div>)}
              </div>}
            </div>
          </div>}

        {/* New Transfer Wizard */}
        <NewTransferWizard open={showNewTransfer} onClose={()=>setShowNewTransfer(false)} prefill={sel && selType==="trf" ? { commodity: sel.commodity, weight: sel.weight, bales: sel.bales, shipmentId: sel.id } : null} />
    </div></div>
    </div>
  );
}
