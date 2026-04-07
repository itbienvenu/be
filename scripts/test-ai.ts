import JobAIService from "@/modules/ai/ai.service.js";
import "dotenv/config";


const rawJobDescription = `
Zipline is the world’s largest and most experienced drone delivery service. We are on a mission to serve all humans equally by ensuring access to food, medicine and essential goods anytime, anywhere. We design, build, and operate the world’s largest autonomous logistics system, delivering critical supplies quickly and reliably. Today, Zipline operates on four continents, makes a delivery somewhere in the world every 30 seconds, and has completed millions of deliveries to date, including blood, vaccines, medical supplies, food, and retail products. 

Our customers include the world’s largest and most prominent healthcare systems, governments, retailers, restaurants and global businesses who rely on us to save lives, reduce emissions, increase economic opportunity, and provide delivery from point A to point B as fast as possible. The drone is only 15% of what we’ve built to enable seamless, reliable, global operations.

Our system strengthens supply chains, reduces congestion, and gives people time back. With more than 140 million commercial autonomous miles safely flown, Zipline is redefining access to healthcare, consumer products, and food across the globe.

We operate at a global scale and are looking for practical problem solvers who thrive on real-world challenges and rapid growth. Our team is motivated by building systems that have a direct, meaningful impact on people’s lives and by scaling the future of logistics. We are seeking people who sculpt from first principles, enjoy facing adversity, and can do the impossible at record breaking speeds.
 
About You and The Role  

We are seeking a talented and motivated Software Tools Engineer to join our Autonomy Annotation team, where you will play a pivotal role in building, enhancing, and maintaining the tools used for annotation to support Zipline’s autonomy development efforts. In this role, you will focus on developing and supporting tools used by both the Annotation Team, internal customers and external contractors responsible for annotations. Your work will help enable the quality and scalability of the data used to train and validate autonomous systems, directly impacting the performance and safety of our autonomous aircraft.
What You'll Do  

    Tool Development & Maintenance: Design, develop and maintain a suite of internal and external-facing tools that support the annotation team processes.
    Collaboration with Internal Customers: Work closely with the Internal Customers (Perception and ML teams) to understand their needs and requirements for annotation tools, ensuring that the tools are optimized for their workflows and deliver high-quality, accurate data.
    External Tool Integration: Facilitate seamless integration with external contractors responsible for data annotation, managing tool access and ensuring proper data handling and security practices.
    Automation & Efficiency: Identify opportunities to automate and optimize manual processes within the annotation workflows to reduce time and increase efficiency without compromising quality.
    Data Integrity & Quality Control: Implement features to track the progress and quality of annotations, monitor for errors and provide feedback to ensure the highest standards of data quality.
    Version Control & Documentation: Maintain versioned releases of the annotation tools, ensuring proper documentation is in place for both internal users and external contractors.
    Bug Fixes & Troubleshooting: Respond to and resolve technical issues that arise with annotation tools, both in production environments and in development cycles.
    Cross-Functional Collaboration: Work with other engineering teams (e.g., Data Platform Team) to integrate the annotation tools with other internal systems and pipelines, as well as ensure smooth data flow between teams.
    Continuous Improvement: Continuously monitor the tool usage and performance, gather feedback from users, and iterate on the tools to improve usability, scalability and efficiency.

What You'll Bring 

Required:

    Bachelor’s or Master’s degree in Software, Computer Science, Engineering, or a related field, or equivalent practical experience.
    Strong proficiency in programming languages such as Python, SQL or Rust.
    At least 3 years experience building, deploying, and maintaining software tools or applications that interact with both internal teams and external users/contractors.
    Experience with API integrations, webhooks and other 3rd party integration technologies.
    Familiarity with software development practices, including version control (e.g., Git), testing, and CI/CD pipelines.
    Strong problem-solving skills and ability to troubleshoot complex software issues.
    Excellent communication skills and ability to work effectively with cross-functional teams, both internal and external.

Preferred:

    Familiarity with UI/UX design principles and experience building or enhancing user interfaces.
    Knowledge of database management and integration (e.g., SQL, NoSQL).
    Experience with cloud platforms (e.g., AWS, GCP) or containerization technologies (e.g., Docker, Kubernetes).
    Familiarity with data annotation platforms or tools used in AI and machine learning workflows (e.g., Labelbox, v7, Encord, etc.).
    Experience with autonomous systems, robotics, or machine learning/AI-based tools.
    Familiarity with Agile development methodologies.

Soft Skills:

    Collaboration: Ability to collaborate effectively with cross-functional teams and external contractors in a dynamic, fast-paced environment.
    Adaptability: Willingness to learn new technologies and adapt to changing project requirements.
    Detail-Oriented: Strong attention to detail and a focus on maintaining high standards for data quality and tool performance.
    Customer-Centric: A mindset of delivering excellent service to internal and external users, including contractors and team members.
    Ownership & Accountability: Ability to take ownership of tasks and projects, driving them to completion with minimal supervision.
    Upskilling Others / Knowledge Transfer: Willingness and ability to mentor and upskill fellow software engineers. You will actively contribute to fostering a culture of continuous learning by sharing knowledge, best practices and insights to help develop and elevate the technical skills of the team.

What Else You Need to Know   
Zipline is an equal opportunity employer and prohibits discrimination and harassment of any type without regard to race, color, ancestry, national origin, religion or religious creed, mental or physical disability, medical condition, genetic information, sex (including pregnancy, childbirth, and related medical conditions), sexual orientation, gender identity, gender expression, age, marital status, military or veteran status, citizenship, or other characteristics protected by state, federal or local law or our other policies.
 
We value diversity at Zipline and welcome applications from those who are traditionally underrepresented in tech. If you like the sound of this position but are not sure if you are the perfect fit, please apply!
 
Please Note

We have received reports stating that certain individuals are reaching out to people under false pretenses, claiming to be Zipline employees, affiliates, agents, or representatives. They may seek to gain access to your personal information or to acquire money from you by offering fictitious employment opportunities or by claiming that they are contacting you on Zipline’s behalf.

Genuine Zipline employees or representatives will never ask you for money or payment in exchange for employment opportunities or other related services. Any such offer of employment or any other service in exchange for fees that claims to be from us is deceitful and part of a fraud.

If you believe you have been targeted by a fraudulent party, we ask that you immediately get in touch with us via email at security@flyzipline.com upon receiving a suspicious offer or claim.

`;

async function test() {
    const aiService = new JobAIService();
    const structuredJob = await aiService.generateStructuredJob(rawJobDescription);

    if (structuredJob) {
        console.log("✅ Structured Job JSON:");
        console.log(JSON.stringify(structuredJob, null, 2));
    } else {
        console.error("❌ Failed to generate structured job JSON");
    }
}

test();