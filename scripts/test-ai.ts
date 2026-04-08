import JobAIService from "../src/modules/ai/ai.service.js";
import "dotenv/config";


const rawJobDescription = `


Welthungerhilfe is one of the largest Non-Governmental aid agencies in Germany providing long term development assistance projects. Welthungerhilfe has supported Kenyan development organizations since its establishment in 1962. It has had an office in Nairobi since its registration as an NGO operating in Kenya since 1993. Geographically, Welthungerhilfe's i... 
ob Type Full Time
Qualification BA/BSc/HND , MBA/MSc/MA
Experience 5 years
Location Nairobi
Job Field Project Management  

Your responsibilities

    Work closely with country offices to identify, develop, and advance strategic foundation partnership opportunities.
    Collaborate with country teams in building and managing strong foundation prospect pipelines, identifying opportunities that align with programmatic priorities and funding strategies.
    Accompany country offices in the cultivation and development of foundation partnerships, including donor outreach strategies, engagement planning, and partnership positioning.
    Contribute to developing partnership pitches, concepts, and cases for support together with country teams, translating programmatic priorities and impact evidence into compelling foundation-facing propositions.
    Facilitate exchange of successful practices, market insights, and fundraising approaches across country offices to strengthen the organization’s overall capacity to engage foundations.
    Identify and pursue selected strategic foundation opportunities, particularly with regional or locally present foundations, in close coordination with relevant country offices and head office colleagues.
    Coordinate closely with WHH colleagues wordwide to ensure aligned relationship management and coordinated donor engagement.
    Develop high-quality pitches, concept notes, proposals, and partnership propositions in collaboration with technical experts, program and country teams.
    Support due diligence processes and risk assessments for prospective foundation partners in line with Welthungerhilfe’s policies and compliance requirements.

Your profile

    A Bachelor’s degree required; a Master’s degree in a relevant field (e.g. International Relations, Nonprofit Management, Development Studies, Marketing, or Communications) is strongly preferred. 
    At least five years of progressive experience in foundation fundraising or institutional philanthropy, ideally within an international NGO or global development context.
    Demonstrated ability to secure six- and seven-figure grants from foundations and manage long-term donor relationships.
    Strong analytical and strategic skills to translate complex programmatic information into compelling, impact-driven funding propositions.
    Experience using donor relationship management systems (e.g., Salesforce or equivalent) to maintain a structured partner pipeline and monitor engagement.
    Excellent interpersonal and networking skills with the ability to build trust and collaborate effectively across cultures, functions, and levels of seniority.
    High degree of independence, organization, and reliability, with the ability to manage multiple priorities and deliver results in a dynamic environment.
    Ability to thrive in a dynamic, fast-paced environment and adapt strategies to evolving philanthropic trends.
    You recognize the growing value of data in your field and are eager to build your awareness and skills to incorporate data-informed approaches into your work.
    Exceptional written and verbal English skills, with proven ability to develop persuasive, donor-oriented proposals and reports. Proficiency in additional languages is an asset.
`;

async function test() {
    const aiService = new JobAIService();
    const structuredJob = await aiService.generateStructuredJob(rawJobDescription);

    if (structuredJob) {
        console.log("Structured Job JSON:");
        console.log(JSON.stringify(structuredJob, null, 2));
    } else {
        console.error("Failed to generate structured job JSON");
    }
}


test();