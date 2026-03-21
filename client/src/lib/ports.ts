/**
 * Major international trade ports with UN/LOCODE codes
 * Organized by region for easy browsing
 * Format: { code: "XXYYY", name: "Port Name", country: "Country", region: "Region" }
 *
 * Comprehensive coverage for: Kuwait, Qatar, KSA, UAE, Jordan, Oman, Bahrain, Egypt
 * Plus major global trade ports
 */

export interface Port {
  code: string;      // UN/LOCODE (e.g., "AEJEA")
  name: string;      // Port name (e.g., "Jebel Ali")
  country: string;   // Country name
  region: string;    // Geographic region
}

export const PORTS: Port[] = [
  // ══════════════════════════════════════════════════════════════════════
  // UAE — Comprehensive
  // ══════════════════════════════════════════════════════════════════════
  { code: "AEJEA", name: "Jebel Ali", country: "UAE", region: "Middle East" },
  { code: "AEAUH", name: "Abu Dhabi (Khalifa Port)", country: "UAE", region: "Middle East" },
  { code: "AEDXB", name: "Dubai (Port Rashid)", country: "UAE", region: "Middle East" },
  { code: "AESHJ", name: "Sharjah (Khalid Port)", country: "UAE", region: "Middle East" },
  { code: "AEFJR", name: "Fujairah", country: "UAE", region: "Middle East" },
  { code: "AEKLF", name: "Khor Fakkan", country: "UAE", region: "Middle East" },
  { code: "AERKT", name: "Ras Al Khaimah", country: "UAE", region: "Middle East" },
  { code: "AEAJM", name: "Ajman", country: "UAE", region: "Middle East" },
  { code: "AERUW", name: "Ruwais", country: "UAE", region: "Middle East" },
  { code: "AEMZD", name: "Mina Zayed (Abu Dhabi)", country: "UAE", region: "Middle East" },
  { code: "AEMSA", name: "Mina Saqr (Ras Al Khaimah)", country: "UAE", region: "Middle East" },
  { code: "AEQIW", name: "Umm Al Quwain", country: "UAE", region: "Middle East" },
  { code: "AEDAS", name: "Das Island", country: "UAE", region: "Middle East" },
  { code: "AEDBP", name: "Dibba", country: "UAE", region: "Middle East" },
  { code: "AEAMF", name: "Musaffah (Abu Dhabi)", country: "UAE", region: "Middle East" },
  { code: "AEKLB", name: "Kalba", country: "UAE", region: "Middle East" },
  { code: "AEJAZ", name: "Al Jazeera Port", country: "UAE", region: "Middle East" },
  { code: "AEHZP", name: "Hamriyah Free Zone Port", country: "UAE", region: "Middle East" },
  { code: "AERWP", name: "Ruwais Port", country: "UAE", region: "Middle East" },
  { code: "AEFRP", name: "Free Port (Dubai)", country: "UAE", region: "Middle East" },

  // ══════════════════════════════════════════════════════════════════════
  // Saudi Arabia (KSA) — Comprehensive
  // ══════════════════════════════════════════════════════════════════════
  { code: "SAJED", name: "Jeddah (Islamic Port)", country: "Saudi Arabia", region: "Middle East" },
  { code: "SADMM", name: "Dammam (King Abdulaziz Port)", country: "Saudi Arabia", region: "Middle East" },
  { code: "SAJUB", name: "Jubail (Commercial Port)", country: "Saudi Arabia", region: "Middle East" },
  { code: "SAJBI", name: "Jubail Industrial City", country: "Saudi Arabia", region: "Middle East" },
  { code: "SAYNB", name: "Yanbu (Commercial Port)", country: "Saudi Arabia", region: "Middle East" },
  { code: "SAYBI", name: "Yanbu Industrial City", country: "Saudi Arabia", region: "Middle East" },
  { code: "SAKAC", name: "King Abdullah Port (KAEC)", country: "Saudi Arabia", region: "Middle East" },
  { code: "SARAZ", name: "Ras Al-Khair", country: "Saudi Arabia", region: "Middle East" },
  { code: "SAGIZ", name: "Jizan", country: "Saudi Arabia", region: "Middle East" },
  { code: "SAJEC", name: "Jazan Economic City", country: "Saudi Arabia", region: "Middle East" },
  { code: "SAJUT", name: "Juaymah Terminal", country: "Saudi Arabia", region: "Middle East" },
  { code: "SARTA", name: "Ras Tanura", country: "Saudi Arabia", region: "Middle East" },
  { code: "SARAR", name: "Ras Al Khafji", country: "Saudi Arabia", region: "Middle East" },
  { code: "SARAM", name: "Ras Al Mishab", country: "Saudi Arabia", region: "Middle East" },
  { code: "SARAB", name: "Rabigh", country: "Saudi Arabia", region: "Middle East" },
  { code: "SASHU", name: "Shuaibah", country: "Saudi Arabia", region: "Middle East" },
  { code: "SAJYC", name: "Jeddah Yacht Club Port", country: "Saudi Arabia", region: "Middle East" },
  { code: "SANEO", name: "NEOM", country: "Saudi Arabia", region: "Middle East" },
  { code: "SADHU", name: "Port of NEOM", country: "Saudi Arabia", region: "Middle East" },
  { code: "SAALK", name: "Al Khobar", country: "Saudi Arabia", region: "Middle East" },
  { code: "SAAQK", name: "Al Khobar Port", country: "Saudi Arabia", region: "Middle East" },
  { code: "SAAHA", name: "Al Hada", country: "Saudi Arabia", region: "Middle East" },
  { code: "SAVLA", name: "Umm Lajj", country: "Saudi Arabia", region: "Middle East" },
  { code: "SALIT", name: "Lith", country: "Saudi Arabia", region: "Middle East" },
  { code: "SAEJH", name: "Wedjh (Al Wajh)", country: "Saudi Arabia", region: "Middle East" },
  { code: "SAQAL", name: "Qalsn", country: "Saudi Arabia", region: "Middle East" },
  { code: "SAQUN", name: "Al Qunfudah", country: "Saudi Arabia", region: "Middle East" },
  { code: "SAQAH", name: "Al Qahmah", country: "Saudi Arabia", region: "Middle East" },
  { code: "SARYPD", name: "Riyadh Dry Port", country: "Saudi Arabia", region: "Middle East" },

  // ══════════════════════════════════════════════════════════════════════
  // Kuwait — Comprehensive
  // ══════════════════════════════════════════════════════════════════════
  { code: "KWSWK", name: "Shuwaikh", country: "Kuwait", region: "Middle East" },
  { code: "KWSAA", name: "Shuaiba", country: "Kuwait", region: "Middle East" },
  { code: "KWKWI", name: "Kuwait Port", country: "Kuwait", region: "Middle East" },
  { code: "KWMEA", name: "Mina Al Ahmadi", country: "Kuwait", region: "Middle East" },
  { code: "KWMIB", name: "Mina Abdullah", country: "Kuwait", region: "Middle East" },
  { code: "KWMZR", name: "Mina Al Zour", country: "Kuwait", region: "Middle East" },
  { code: "KWMIS", name: "Mina Saud", country: "Kuwait", region: "Middle East" },
  { code: "KWDOH", name: "Doha (Kuwait)", country: "Kuwait", region: "Middle East" },
  { code: "KWSAL", name: "As Salimiyah", country: "Kuwait", region: "Middle East" },
  { code: "KWSMY", name: "Salmiya", country: "Kuwait", region: "Middle East" },
  { code: "KWKHT", name: "As Sulaybikhat", country: "Kuwait", region: "Middle East" },
  { code: "KWJBD", name: "Jebel Dhana", country: "Kuwait", region: "Middle East" },
  { code: "KWKWM", name: "Khor Al Mufatta", country: "Kuwait", region: "Middle East" },

  // ══════════════════════════════════════════════════════════════════════
  // Qatar — Comprehensive
  // ══════════════════════════════════════════════════════════════════════
  { code: "QAHMD", name: "Hamad Port", country: "Qatar", region: "Middle East" },
  { code: "QADOH", name: "Doha", country: "Qatar", region: "Middle East" },
  { code: "QAUMS", name: "Umm Said (Mesaieed)", country: "Qatar", region: "Middle East" },
  { code: "QARLF", name: "Ras Laffan", country: "Qatar", region: "Middle East" },
  { code: "QASLW", name: "As Salwa", country: "Qatar", region: "Middle East" },
  { code: "QARUS", name: "Al Ruwais", country: "Qatar", region: "Middle East" },
  { code: "QAHAL", name: "Halul Island", country: "Qatar", region: "Middle East" },
  { code: "QAHNA", name: "Hanna", country: "Qatar", region: "Middle East" },
  { code: "QAQAP", name: "Qapco Terminal", country: "Qatar", region: "Middle East" },
  { code: "QAQCH", name: "Qchem Terminal", country: "Qatar", region: "Middle East" },

  // ══════════════════════════════════════════════════════════════════════
  // Bahrain — Comprehensive
  // ══════════════════════════════════════════════════════════════════════
  { code: "BHKBS", name: "Khalifa Bin Salman Port", country: "Bahrain", region: "Middle East" },
  { code: "BHMIN", name: "Mina Sulman Port", country: "Bahrain", region: "Middle East" },
  { code: "BHAHD", name: "Al Hidd", country: "Bahrain", region: "Middle East" },
  { code: "BHGBQ", name: "Al Muharraq", country: "Bahrain", region: "Middle East" },
  { code: "BHSIT", name: "Sitrah", country: "Bahrain", region: "Middle East" },

  // ══════════════════════════════════════════════════════════════════════
  // Oman — Comprehensive
  // ══════════════════════════════════════════════════════════════════════
  { code: "OMSLL", name: "Salalah", country: "Oman", region: "Middle East" },
  { code: "OMSOH", name: "Sohar", country: "Oman", region: "Middle East" },
  { code: "OMMCT", name: "Muscat", country: "Oman", region: "Middle East" },
  { code: "OMSTQ", name: "Mina Sultan Qaboos (Muscat)", country: "Oman", region: "Middle East" },
  { code: "OMDQM", name: "Duqm", country: "Oman", region: "Middle East" },
  { code: "OMFAH", name: "Fahal Island", country: "Oman", region: "Middle East" },
  { code: "OMMFH", name: "Mina Al Fahl", country: "Oman", region: "Middle East" },
  { code: "OMQAL", name: "Qalhat (LNG Terminal)", country: "Oman", region: "Middle East" },
  { code: "OMSHI", name: "Shinas", country: "Oman", region: "Middle East" },
  { code: "OMSUW", name: "Al-Suwaiq", country: "Oman", region: "Middle East" },
  { code: "OMMNH", name: "Al Mudayq", country: "Oman", region: "Middle East" },
  { code: "OMMUT", name: "Muthra", country: "Oman", region: "Middle East" },
  { code: "OMSUL", name: "Port Sultan", country: "Oman", region: "Middle East" },
  { code: "OMRAY", name: "Raysut", country: "Oman", region: "Middle East" },
  { code: "OMOFC", name: "Sur", country: "Oman", region: "Middle East" },
  { code: "OMQUO", name: "Quoin Island", country: "Oman", region: "Middle East" },

  // ══════════════════════════════════════════════════════════════════════
  // Jordan — Comprehensive
  // ══════════════════════════════════════════════════════════════════════
  { code: "JOAQJ", name: "Aqaba", country: "Jordan", region: "Middle East" },
  { code: "JOAQB", name: "Aqaba Container Terminal", country: "Jordan", region: "Middle East" },

  // ══════════════════════════════════════════════════════════════════════
  // Egypt — Comprehensive
  // ══════════════════════════════════════════════════════════════════════
  { code: "EGPSD", name: "Port Said", country: "Egypt", region: "North Africa" },
  { code: "EGPSE", name: "Port Said East", country: "Egypt", region: "North Africa" },
  { code: "EGPSW", name: "Port Said West", country: "Egypt", region: "North Africa" },
  { code: "EGALY", name: "Alexandria", country: "Egypt", region: "North Africa" },
  { code: "EGEDK", name: "El Dekheila (Alexandria)", country: "Egypt", region: "North Africa" },
  { code: "EGDAM", name: "Damietta", country: "Egypt", region: "North Africa" },
  { code: "EGSUZ", name: "Suez", country: "Egypt", region: "North Africa" },
  { code: "EGAIS", name: "Ain Sokhna", country: "Egypt", region: "North Africa" },
  { code: "EGSOK", name: "Sokhna Port (SCZONE)", country: "Egypt", region: "North Africa" },
  { code: "EGADA", name: "Adabiya", country: "Egypt", region: "North Africa" },
  { code: "EGAGN", name: "Abu Ghosoun", country: "Egypt", region: "North Africa" },
  { code: "EGAKI", name: "Abu Kir", country: "Egypt", region: "North Africa" },
  { code: "EGAZA", name: "Abu Zenimah", country: "Egypt", region: "North Africa" },
  { code: "EGAQU", name: "Al Qusayr (El Kosseir)", country: "Egypt", region: "North Africa" },
  { code: "EGBGB", name: "Atakka Dry Port", country: "Egypt", region: "North Africa" },
  { code: "EGDOM", name: "Dome Marina", country: "Egypt", region: "North Africa" },
  { code: "EGGAL", name: "Galala Marina", country: "Egypt", region: "North Africa" },
  { code: "EGHRG", name: "Hurghada", country: "Egypt", region: "North Africa" },
  { code: "EGIKU", name: "Idku (LNG Terminal)", country: "Egypt", region: "North Africa" },
  { code: "EGNUW", name: "Nuweiba", country: "Egypt", region: "North Africa" },
  { code: "EGGLB", name: "Port Ghalib", country: "Egypt", region: "North Africa" },
  { code: "EGPIB", name: "Port Ibrahim", country: "Egypt", region: "North Africa" },
  { code: "EGPTK", name: "Port Tewfik", country: "Egypt", region: "North Africa" },
  { code: "EGSGA", name: "Safaga", country: "Egypt", region: "North Africa" },
  { code: "EGSSH", name: "Sharm El Sheikh", country: "Egypt", region: "North Africa" },
  { code: "EGTOR", name: "El Tor", country: "Egypt", region: "North Africa" },
  { code: "EGRAG", name: "Ras Gharib", country: "Egypt", region: "North Africa" },
  { code: "EGRSH", name: "Ras Shukheir", country: "Egypt", region: "North Africa" },
  { code: "EGRSU", name: "Ras Sudr", country: "Egypt", region: "North Africa" },
  { code: "EGODP", name: "October Dry Port", country: "Egypt", region: "North Africa" },
  { code: "EGMEA", name: "Porto Marina El Alamein", country: "Egypt", region: "North Africa" },
  { code: "EGSCA", name: "Suez Canal", country: "Egypt", region: "North Africa" },

  // ══════════════════════════════════════════════════════════════════════
  // Iraq / Yemen
  // ══════════════════════════════════════════════════════════════════════
  { code: "IQBSR", name: "Umm Qasr", country: "Iraq", region: "Middle East" },
  { code: "IQKAZ", name: "Khor Al Zubair", country: "Iraq", region: "Middle East" },
  { code: "YEADE", name: "Aden", country: "Yemen", region: "Middle East" },
  { code: "YEHOD", name: "Hodeidah", country: "Yemen", region: "Middle East" },

  // ══════════════════════════════════════════════════════════════════════
  // East Africa
  // ══════════════════════════════════════════════════════════════════════
  { code: "DJJIB", name: "Djibouti", country: "Djibouti", region: "East Africa" },
  { code: "KEMBA", name: "Mombasa", country: "Kenya", region: "East Africa" },
  { code: "TZDAR", name: "Dar es Salaam", country: "Tanzania", region: "East Africa" },
  { code: "MZMPN", name: "Maputo", country: "Mozambique", region: "East Africa" },
  { code: "SDPZU", name: "Port Sudan", country: "Sudan", region: "East Africa" },
  { code: "ERMSW", name: "Massawa", country: "Eritrea", region: "East Africa" },
  { code: "MGDIE", name: "Toamasina", country: "Madagascar", region: "East Africa" },
  { code: "MUPLU", name: "Port Louis", country: "Mauritius", region: "East Africa" },

  // ══════════════════════════════════════════════════════════════════════
  // West Africa
  // ══════════════════════════════════════════════════════════════════════
  { code: "NGAPP", name: "Apapa (Lagos)", country: "Nigeria", region: "West Africa" },
  { code: "NGTIN", name: "Tin Can Island (Lagos)", country: "Nigeria", region: "West Africa" },
  { code: "GHTMA", name: "Tema", country: "Ghana", region: "West Africa" },
  { code: "CIABJ", name: "Abidjan", country: "Ivory Coast", region: "West Africa" },
  { code: "SNDKR", name: "Dakar", country: "Senegal", region: "West Africa" },
  { code: "TGLFW", name: "Lomé", country: "Togo", region: "West Africa" },
  { code: "BJCOO", name: "Cotonou", country: "Benin", region: "West Africa" },
  { code: "CMDLA", name: "Douala", country: "Cameroon", region: "West Africa" },

  // ══════════════════════════════════════════════════════════════════════
  // South Africa
  // ══════════════════════════════════════════════════════════════════════
  { code: "ZADUR", name: "Durban", country: "South Africa", region: "South Africa" },
  { code: "ZACPT", name: "Cape Town", country: "South Africa", region: "South Africa" },
  { code: "ZAPLZ", name: "Port Elizabeth (Gqeberha)", country: "South Africa", region: "South Africa" },

  // ══════════════════════════════════════════════════════════════════════
  // India
  // ══════════════════════════════════════════════════════════════════════
  { code: "INNSA", name: "Nhava Sheva (JNPT)", country: "India", region: "South Asia" },
  { code: "INMUN", name: "Mundra", country: "India", region: "South Asia" },
  { code: "INMAA", name: "Chennai", country: "India", region: "South Asia" },
  { code: "INPAV", name: "Pipavav", country: "India", region: "South Asia" },
  { code: "INTUT", name: "Tuticorin", country: "India", region: "South Asia" },
  { code: "INCCU", name: "Kolkata (Haldia)", country: "India", region: "South Asia" },
  { code: "INCOK", name: "Cochin (Kochi)", country: "India", region: "South Asia" },
  { code: "INKRI", name: "Krishnapatnam", country: "India", region: "South Asia" },
  { code: "INVIS", name: "Visakhapatnam", country: "India", region: "South Asia" },
  { code: "INHZR", name: "Hazira", country: "India", region: "South Asia" },

  // ══════════════════════════════════════════════════════════════════════
  // Pakistan / Sri Lanka / Bangladesh
  // ══════════════════════════════════════════════════════════════════════
  { code: "PKKHI", name: "Karachi", country: "Pakistan", region: "South Asia" },
  { code: "PKQCT", name: "Qasim (Port Qasim)", country: "Pakistan", region: "South Asia" },
  { code: "LKCMB", name: "Colombo", country: "Sri Lanka", region: "South Asia" },
  { code: "BDCGP", name: "Chittagong", country: "Bangladesh", region: "South Asia" },

  // ══════════════════════════════════════════════════════════════════════
  // Southeast Asia
  // ══════════════════════════════════════════════════════════════════════
  { code: "SGSIN", name: "Singapore", country: "Singapore", region: "Southeast Asia" },
  { code: "MYPKG", name: "Port Klang", country: "Malaysia", region: "Southeast Asia" },
  { code: "MYTPP", name: "Tanjung Pelepas", country: "Malaysia", region: "Southeast Asia" },
  { code: "IDTPP", name: "Tanjung Priok (Jakarta)", country: "Indonesia", region: "Southeast Asia" },
  { code: "IDSUB", name: "Surabaya (Tanjung Perak)", country: "Indonesia", region: "Southeast Asia" },
  { code: "THSGZ", name: "Laem Chabang", country: "Thailand", region: "Southeast Asia" },
  { code: "THBKK", name: "Bangkok", country: "Thailand", region: "Southeast Asia" },
  { code: "VNSGN", name: "Ho Chi Minh (Cat Lai)", country: "Vietnam", region: "Southeast Asia" },
  { code: "VNHPH", name: "Hai Phong", country: "Vietnam", region: "Southeast Asia" },
  { code: "PHMNL", name: "Manila", country: "Philippines", region: "Southeast Asia" },
  { code: "MMRGN", name: "Yangon", country: "Myanmar", region: "Southeast Asia" },

  // ══════════════════════════════════════════════════════════════════════
  // China
  // ══════════════════════════════════════════════════════════════════════
  { code: "CNSHA", name: "Shanghai", country: "China", region: "East Asia" },
  { code: "CNSZX", name: "Shenzhen (Shekou/Yantian)", country: "China", region: "East Asia" },
  { code: "CNNBO", name: "Ningbo-Zhoushan", country: "China", region: "East Asia" },
  { code: "CNQIN", name: "Qingdao", country: "China", region: "East Asia" },
  { code: "CNTXG", name: "Tianjin (Xingang)", country: "China", region: "East Asia" },
  { code: "CNGZG", name: "Guangzhou (Nansha)", country: "China", region: "East Asia" },
  { code: "CNXMN", name: "Xiamen", country: "China", region: "East Asia" },
  { code: "CNDLC", name: "Dalian", country: "China", region: "East Asia" },
  { code: "CNLYG", name: "Lianyungang", country: "China", region: "East Asia" },
  { code: "CNFOC", name: "Fuzhou", country: "China", region: "East Asia" },

  // ══════════════════════════════════════════════════════════════════════
  // Hong Kong / Taiwan / South Korea / Japan
  // ══════════════════════════════════════════════════════════════════════
  { code: "HKHKG", name: "Hong Kong", country: "Hong Kong", region: "East Asia" },
  { code: "TWKHH", name: "Kaohsiung", country: "Taiwan", region: "East Asia" },
  { code: "TWKEL", name: "Keelung", country: "Taiwan", region: "East Asia" },
  { code: "KRPUS", name: "Busan", country: "South Korea", region: "East Asia" },
  { code: "KRINC", name: "Incheon", country: "South Korea", region: "East Asia" },
  { code: "JPYOK", name: "Yokohama", country: "Japan", region: "East Asia" },
  { code: "JPTYO", name: "Tokyo", country: "Japan", region: "East Asia" },
  { code: "JPKOB", name: "Kobe", country: "Japan", region: "East Asia" },
  { code: "JPNGO", name: "Nagoya", country: "Japan", region: "East Asia" },
  { code: "JPOSK", name: "Osaka", country: "Japan", region: "East Asia" },

  // ══════════════════════════════════════════════════════════════════════
  // Turkey
  // ══════════════════════════════════════════════════════════════════════
  { code: "TRIST", name: "Istanbul (Ambarli)", country: "Turkey", region: "Europe" },
  { code: "TRMER", name: "Mersin", country: "Turkey", region: "Europe" },
  { code: "TRISK", name: "Iskenderun", country: "Turkey", region: "Europe" },
  { code: "TRIZM", name: "Izmir (Alsancak)", country: "Turkey", region: "Europe" },
  { code: "TRGEM", name: "Gemlik", country: "Turkey", region: "Europe" },
  { code: "TRTZE", name: "Trabzon", country: "Turkey", region: "Europe" },

  // ══════════════════════════════════════════════════════════════════════
  // Mediterranean Europe
  // ══════════════════════════════════════════════════════════════════════
  { code: "GRPIR", name: "Piraeus", country: "Greece", region: "Europe" },
  { code: "ITGOA", name: "Genoa", country: "Italy", region: "Europe" },
  { code: "ITGIT", name: "Gioia Tauro", country: "Italy", region: "Europe" },
  { code: "ITLIV", name: "Livorno", country: "Italy", region: "Europe" },
  { code: "ITNAP", name: "Naples", country: "Italy", region: "Europe" },
  { code: "ESVLC", name: "Valencia", country: "Spain", region: "Europe" },
  { code: "ESBCN", name: "Barcelona", country: "Spain", region: "Europe" },
  { code: "ESALG", name: "Algeciras", country: "Spain", region: "Europe" },
  { code: "MTMAR", name: "Marsaxlokk", country: "Malta", region: "Europe" },
  { code: "FRMRS", name: "Marseille (Fos)", country: "France", region: "Europe" },

  // ══════════════════════════════════════════════════════════════════════
  // North Europe
  // ══════════════════════════════════════════════════════════════════════
  { code: "NLRTM", name: "Rotterdam", country: "Netherlands", region: "Europe" },
  { code: "BEANR", name: "Antwerp", country: "Belgium", region: "Europe" },
  { code: "DEHAM", name: "Hamburg", country: "Germany", region: "Europe" },
  { code: "DEBRV", name: "Bremerhaven", country: "Germany", region: "Europe" },
  { code: "GBFXT", name: "Felixstowe", country: "UK", region: "Europe" },
  { code: "GBSOU", name: "Southampton", country: "UK", region: "Europe" },
  { code: "GBLGP", name: "London Gateway", country: "UK", region: "Europe" },
  { code: "FRLEH", name: "Le Havre", country: "France", region: "Europe" },
  { code: "PLGDY", name: "Gdynia / Gdansk", country: "Poland", region: "Europe" },
  { code: "RULED", name: "St. Petersburg", country: "Russia", region: "Europe" },

  // ══════════════════════════════════════════════════════════════════════
  // Americas
  // ══════════════════════════════════════════════════════════════════════
  { code: "USLAX", name: "Los Angeles / Long Beach", country: "USA", region: "Americas" },
  { code: "USNYC", name: "New York / New Jersey", country: "USA", region: "Americas" },
  { code: "USSAV", name: "Savannah", country: "USA", region: "Americas" },
  { code: "USHOU", name: "Houston", country: "USA", region: "Americas" },
  { code: "USCHA", name: "Charleston", country: "USA", region: "Americas" },
  { code: "USNOR", name: "Norfolk", country: "USA", region: "Americas" },
  { code: "USOAK", name: "Oakland", country: "USA", region: "Americas" },
  { code: "BRSSZ", name: "Santos", country: "Brazil", region: "Americas" },
  { code: "ARBUE", name: "Buenos Aires", country: "Argentina", region: "Americas" },
  { code: "PAMIT", name: "Balboa (Panama)", country: "Panama", region: "Americas" },
  { code: "PACOL", name: "Colón (Panama)", country: "Panama", region: "Americas" },
  { code: "COBUN", name: "Buenaventura", country: "Colombia", region: "Americas" },
  { code: "CLSAI", name: "San Antonio", country: "Chile", region: "Americas" },
  { code: "MXZLO", name: "Manzanillo", country: "Mexico", region: "Americas" },
  { code: "MXLZC", name: "Lázaro Cárdenas", country: "Mexico", region: "Americas" },

  // ══════════════════════════════════════════════════════════════════════
  // North Africa (non-Egypt)
  // ══════════════════════════════════════════════════════════════════════
  { code: "MATNG", name: "Tanger Med", country: "Morocco", region: "North Africa" },
  { code: "MACAS", name: "Casablanca", country: "Morocco", region: "North Africa" },
  { code: "DZALG", name: "Algiers", country: "Algeria", region: "North Africa" },
  { code: "DZORN", name: "Oran", country: "Algeria", region: "North Africa" },
  { code: "TNTUN", name: "Tunis (Radès)", country: "Tunisia", region: "North Africa" },
  { code: "LYKHM", name: "Khoms (Al Khums)", country: "Libya", region: "North Africa" },
  { code: "LYMIS", name: "Misrata", country: "Libya", region: "North Africa" },
  { code: "LYTIP", name: "Tripoli", country: "Libya", region: "North Africa" },
  { code: "LYBEN", name: "Benghazi", country: "Libya", region: "North Africa" },

  // ══════════════════════════════════════════════════════════════════════
  // Australia / New Zealand
  // ══════════════════════════════════════════════════════════════════════
  { code: "AUMEL", name: "Melbourne", country: "Australia", region: "Oceania" },
  { code: "AUSYD", name: "Sydney", country: "Australia", region: "Oceania" },
  { code: "AUBNE", name: "Brisbane", country: "Australia", region: "Oceania" },
  { code: "AUFRE", name: "Fremantle (Perth)", country: "Australia", region: "Oceania" },
  { code: "NZAKL", name: "Auckland", country: "New Zealand", region: "Oceania" },
];

/** Group ports by region for display */
export function getPortsByRegion(): { region: string; ports: Port[] }[] {
  const map = new Map<string, Port[]>();
  // Maintain region order
  const regionOrder = [
    "Middle East", "North Africa", "East Africa", "West Africa", "South Africa",
    "South Asia", "Southeast Asia", "East Asia",
    "Europe", "Americas", "Oceania",
  ];
  for (const r of regionOrder) map.set(r, []);
  for (const p of PORTS) {
    if (!map.has(p.region)) map.set(p.region, []);
    map.get(p.region)!.push(p);
  }
  return Array.from(map.entries())
    .filter(([, ports]) => ports.length > 0)
    .map(([region, ports]) => ({ region, ports }));
}

/** Search ports by query (matches code, name, or country) */
export function searchPorts(query: string): Port[] {
  if (!query || query.trim().length === 0) return PORTS;
  const q = query.toLowerCase().trim();
  return PORTS.filter(p =>
    p.code.toLowerCase().includes(q) ||
    p.name.toLowerCase().includes(q) ||
    p.country.toLowerCase().includes(q)
  );
}
