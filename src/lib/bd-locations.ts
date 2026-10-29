export interface DistrictOption {
  name: string;
  nameBn: string;
  division: string;
  isSylhet: boolean;
  upazilas: string[];
}

export const BANGLADESH_DISTRICTS: DistrictOption[] = [
  {
    name: 'Sylhet',
    nameBn: 'সিলেট',
    division: 'Sylhet',
    isSylhet: true,
    upazilas: [
      'Sylhet Sadar (সিলেট সদর / মেট্রোপলিটন)',
      'Beanibazar (বিয়ানীবাজার)',
      'Bishwanath (বিশ্বনাথ)',
      'Companiganj (কোম্পানীগঞ্জ)',
      'Dakshin Surma (দক্ষিণ সুরমা)',
      'Fenchuganj (ফেঞ্চুগঞ্জ)',
      'Golapganj (গোলাপগঞ্জ)',
      'Gowainghat (গোয়াইনঘাট)',
      'Jaintiapur (জৈন্তাপুর)',
      'Kanaighat (কানাইঘাট)',
      'Osmaninagar (ওসমানীনগর)',
      'Zakiganj (জকিগঞ্জ)',
    ],
  },
  {
    name: 'Moulvibazar',
    nameBn: 'মৌলভীবাজার',
    division: 'Sylhet',
    isSylhet: false,
    upazilas: [
      'Moulvibazar Sadar (মৌলভীবাজার সদর)',
      'Sreemangal (শ্রীমঙ্গল)',
      'Kulaura (কুলাউড়া)',
      'Kamalganj (কমলগঞ্জ)',
      'Barlekha (বড়লেখা)',
      'Juri (জুড়ী)',
      'Rajnagar (রাজনগর)',
    ],
  },
  {
    name: 'Habiganj',
    nameBn: 'হবিগঞ্জ',
    division: 'Sylhet',
    isSylhet: false,
    upazilas: [
      'Habiganj Sadar (হবিগঞ্জ সদর)',
      'Madhabpur (মাধবপুর)',
      'Chunarughat (চুনারুঘাট)',
      'Nabiganj (নবীগঞ্জ)',
      'Bahubal (বাহুবল)',
      'Baniachong (বানিয়াচং)',
      'Ajmiriganj (আজমিরীগঞ্জ)',
      'Lakhai (লাখাই)',
    ],
  },
  {
    name: 'Sunamganj',
    nameBn: 'সুনামগঞ্জ',
    division: 'Sylhet',
    isSylhet: false,
    upazilas: [
      'Sunamganj Sadar (সুনামগঞ্জ সদর)',
      'Chhatak (ছাতক)',
      'Jagannathpur (জগন্নাথপুর)',
      'Tahirpur (তাহিরপুর)',
      'Derai (দিরাই)',
      'Bishwamvarpur (বিশ্বম্ভরপুর)',
      'Doarabazar (দোয়ারাবাজার)',
    ],
  },
  {
    name: 'Dhaka',
    nameBn: 'ঢাকা',
    division: 'Dhaka',
    isSylhet: false,
    upazilas: [
      'Dhanmondi (ধানমন্ডি)',
      'Gulshan / Banani (গুলশান / বনানী)',
      'Mirpur (মিরপুর)',
      'Uttara (উত্তরা)',
      'Mohammadpur (মোহাম্মদপুর)',
      'Motijheel / Paltan (মতিঝিল / পল্টন)',
      'Badda / Rampura (বাড্ডা / রামপুরা)',
      'Savar (সাভার)',
      'Keraniganj (কেরানীগঞ্জ)',
    ],
  },
  {
    name: 'Chattogram',
    nameBn: 'চট্টগ্রাম',
    division: 'Chattogram',
    isSylhet: false,
    upazilas: [
      'Kotwali / GEC (কোতোয়ালী / জিইসি)',
      'Panchlaish / Nasirabad (পাঁচলাইশ / নাসিরাবাদ)',
      'Agrabad / Halishahar (আগ্রাবাদ / হালিশহর)',
      'Patiya (পটিয়া)',
      'Sitakunda (সীতাকুণ্ড)',
      'Hathazari (হাটহাজারী)',
    ],
  },
  {
    name: 'Gazipur',
    nameBn: 'গাজীপুর',
    division: 'Dhaka',
    isSylhet: false,
    upazilas: ['Gazipur Sadar (গাজীপুর সদর)', 'Tongi (টঙ্গী)', 'Kaliakair (কালিয়াকৈর)', 'Sreepur (শ্রীপুর)'],
  },
  {
    name: 'Narayanganj',
    nameBn: 'নারায়ণগঞ্জ',
    division: 'Dhaka',
    isSylhet: false,
    upazilas: ['Narayanganj Sadar (নারায়ণগঞ্জ সদর)', 'Siddhirganj (সিদ্ধিরগঞ্জ)', 'Fatullah (ফতুল্লা)', 'Rupganj (রূপগঞ্জ)'],
  },
  {
    name: 'Cumilla',
    nameBn: 'কুমিল্লা',
    division: 'Chattogram',
    isSylhet: false,
    upazilas: ['Cumilla Adarsha Sadar (কুমিল্লা সদর)', 'Laksam (লাকসাম)', 'Daudkandi (দাউদকান্দি)', 'Chauddagram (চৌদ্দগ্রাম)'],
  },
  {
    name: 'Rajshahi',
    nameBn: 'রাজশাহী',
    division: 'Rajshahi',
    isSylhet: false,
    upazilas: ['Boalia / Rajshahi City (বোয়ালিয়া / রাজশাহী সিটি)', 'Rajpara (রাজপাড়া)', 'Paba (পবা)', 'Godagari (গোদাগাড়ী)'],
  },
  {
    name: 'Bogura',
    nameBn: 'বগুড়া',
    division: 'Rajshahi',
    isSylhet: false,
    upazilas: ['Bogura Sadar (বগুড়া সদর)', 'Shajahanpur (শাজাহানপুর)', 'Sherpur (শেরপুর)', 'Dupchanchia (দুপচাঁচিয়া)'],
  },
  {
    name: 'Khulna',
    nameBn: 'খুলনা',
    division: 'Khulna',
    isSylhet: false,
    upazilas: ['Khulna Sadar / Sonadanga (খুলনা সদর / সোনাডাঙ্গা)', 'Khalishpur (খালিশপুর)', 'Dumuria (ডুমুরিয়া)', 'Phultala (ফুলতলা)'],
  },
  {
    name: 'Jashore',
    nameBn: 'যশোর',
    division: 'Khulna',
    isSylhet: false,
    upazilas: ['Jashore Sadar (যশোর সদর)', 'Jhikargachha (ঝিকরগাছা)', 'Abhaynagar (অভয়নগর)', 'Sharsha (শার্শা)'],
  },
  {
    name: 'Barishal',
    nameBn: 'বরিশাল',
    division: 'Barishal',
    isSylhet: false,
    upazilas: ['Barishal Sadar (বরিশাল সদর)', 'Bakerganj (বাকেরগঞ্জ)', 'Babuganj (বাবুগঞ্জ)', 'Gournadi (গৌরনদী)'],
  },
  {
    name: 'Rangpur',
    nameBn: 'রংপুর',
    division: 'Rangpur',
    isSylhet: false,
    upazilas: ['Rangpur Sadar (রংপুর সদর)', 'Mithapukur (মিঠাপুকুর)', 'Pirganj (পীরগঞ্জ)', 'Badarganj (বদরগঞ্জ)'],
  },
  {
    name: 'Mymensingh',
    nameBn: 'ময়মনসিংহ',
    division: 'Mymensingh',
    isSylhet: false,
    upazilas: ['Mymensingh Sadar (ময়মনসিংহ সদর)', 'Trishal (ত্রিশাল)', 'Bhaluka (ভালুকা)', 'Muktagachha (মুক্তাগাছা)'],
  },
  {
    name: 'Coxs Bazar',
    nameBn: 'কক্সবাজার',
    division: 'Chattogram',
    isSylhet: false,
    upazilas: ['Coxs Bazar Sadar (কক্সবাজার সদর)', 'Chakaria (চকরিয়া)', 'Ramu (রামু)', 'Ukhiya (উখিয়া)'],
  },
  {
    name: 'Brahmanbaria',
    nameBn: 'ব্রাহ্মণবাড়িয়া',
    division: 'Chattogram',
    isSylhet: false,
    upazilas: ['Brahmanbaria Sadar (ব্রাহ্মণবাড়িয়া সদর)', 'Ashuganj (আশুগঞ্জ)', 'Kasba (কসবা)', 'Sarail (সরাইল)'],
  },
  {
    name: 'Noakhali',
    nameBn: 'নোয়াখালী',
    division: 'Chattogram',
    isSylhet: false,
    upazilas: ['Noakhali Sadar / Maijdee (নোয়াখালী সদর)', 'Begumganj (বেগমগঞ্জ)', 'Chatkhil (চাটখিল)', 'Senbagh (সেনবাগ)'],
  },
  {
    name: 'Feni',
    nameBn: 'ফেনী',
    division: 'Chattogram',
    isSylhet: false,
    upazilas: ['Feni Sadar (ফেনী সদর)', 'Daganbhuiyan (দাগনভূঞা)', 'Chhagalnaiya (ছাগলনাইয়া)', 'Sonagazi (সোনাগাজী)'],
  },
];

// Normalize Bangladeshi mobile phone numbers to 11-digit 01XXXXXXXXX format
export function normalizeBdPhone(rawPhone: string): string {
  const digitsOnly = rawPhone.replace(/[^\d+]/g, '');
  let cleaned = digitsOnly;
  if (cleaned.startsWith('+880')) {
    cleaned = '0' + cleaned.slice(4);
  } else if (cleaned.startsWith('880') && cleaned.length === 13) {
    cleaned = '0' + cleaned.slice(3);
  }
  return cleaned;
}

export function isValidBdPhone(rawPhone: string): boolean {
  const normalized = normalizeBdPhone(rawPhone);
  return /^01[3-9]\d{8}$/.test(normalized);
}

export function formatBdt(amount: number): string {
  return `৳${Math.round(amount).toLocaleString('en-IN')}`;
}
