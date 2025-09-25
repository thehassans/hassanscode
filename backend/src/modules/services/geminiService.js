import { GoogleGenerativeAI } from '@google/generative-ai';

class GeminiService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.initialize();
  }

  initialize() {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn('GEMINI_API_KEY not found in environment variables');
        return;
      }

      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      console.log('Gemini AI service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Gemini AI service:', error);
    }
  }

  async generateProductDescription(productName, category, additionalInfo = '') {
    if (!this.model) {
      throw new Error('Gemini AI service not initialized. Please check your API key.');
    }

    try {
      const prompt = `
        Generate a compelling and detailed product description for an e-commerce website.
        
        Product Name: ${productName}
        Category: ${category}
        Additional Information: ${additionalInfo}
        
        Please create:
        1. A main product description (2-3 paragraphs, engaging and informative)
        2. Key features (4-6 bullet points)
        3. Technical specifications (if applicable)
        4. Why customers should choose this product (1 paragraph)
        
        Format the response as JSON with the following structure:
        {
          "description": "Main product description here",
          "keyFeatures": ["Feature 1", "Feature 2", "Feature 3", "Feature 4"],
          "specifications": {
            "material": "if applicable",
            "dimensions": "if applicable",
            "weight": "if applicable",
            "warranty": "if applicable"
          },
          "whyChoose": "Compelling reason to choose this product"
        }
        
        Make it sound professional, engaging, and suitable for online shopping.
        Focus on benefits and value proposition for the customer.
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Try to parse JSON from the response
      try {
        // Extract JSON from the response (in case it's wrapped in markdown)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        } else {
          // Fallback: create structured response from plain text
          return {
            description: text,
            keyFeatures: [],
            specifications: {},
            whyChoose: ''
          };
        }
      } catch (parseError) {
        console.warn('Failed to parse JSON response, returning plain text');
        return {
          description: text,
          keyFeatures: [],
          specifications: {},
          whyChoose: ''
        };
      }
    } catch (error) {
      console.error('Error generating product description:', error);
      throw new Error('Failed to generate product description. Please try again.');
    }
  }

  async generateProductTags(productName, category, description = '') {
    if (!this.model) {
      throw new Error('Gemini AI service not initialized. Please check your API key.');
    }

    try {
      const prompt = `
        Generate relevant tags/keywords for this e-commerce product:
        
        Product Name: ${productName}
        Category: ${category}
        Description: ${description}
        
        Generate 8-12 relevant tags that customers might search for.
        Return as a JSON array of strings.
        Example: ["tag1", "tag2", "tag3"]
        
        Focus on:
        - Product type and category
        - Key features and benefits
        - Use cases and applications
        - Target audience
        - Material or style (if applicable)
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        } else {
          // Fallback: extract tags from text
          return text.split(',').map(tag => tag.trim().replace(/['"]/g, '')).slice(0, 10);
        }
      } catch (parseError) {
        console.warn('Failed to parse tags response');
        return [];
      }
    } catch (error) {
      console.error('Error generating product tags:', error);
      return [];
    }
  }

  isAvailable() {
    return this.model !== null;
  }
}

// Export singleton instance
export default new GeminiService();