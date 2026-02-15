import { createSupabaseBrowserClient } from '@/supabase/supabase-client';

export const fetchAllCounsel = async () => {
    const supabase = createSupabaseBrowserClient();
  
    try {
      const { data, error } = await supabase
        .from('counsel')
        .select(
          '*'
        );
  
      if (error) {
        console.error('Error fetching counsel data:', error.message);
        throw new Error('Failed to fetch counsel data.');
      }
      console.log(data);
      
      return data;
    } catch (error) {
      console.error('Unexpected error while fetching counsel data:', error);
      throw error;
    }
  };


export const fetchCounselWithClient = async (counselId: number) => {
  const supabase = createSupabaseBrowserClient();

  console.log('Fetching counsel with ID:', counselId);

  try {
    const { data: counsel, error: counselError } = await supabase
      .from('counsel')
      .select('*') 
      .eq('counsel_id', counselId)
      .single();

    if (counselError) {
      console.error('Error fetching counsel data:', counselError.message);
      throw new Error('Failed to fetch counsel data.');
    }

    if (!counsel) {
      console.warn(`No counsel found for counsel_id ${counselId}`);
      return null; 
    }


    const clientId = counsel.client_id;
    let client = null;

    if (clientId) {
      const { data: clientData, error: clientError } = await supabase
        .from('client')
        .select('*') // Select all fields from the client table
        .eq('user_id', clientId)
        .single();

      if (clientError) {
        console.error('Error fetching client data:', clientError.message);
        throw new Error('Failed to fetch client data.');
      }

      client = {
        id: clientData.user_id,
        name: clientData.company_name || 'Unknown Company',
        email: clientData.email || 'Unknown Email',
        contact: clientData.contact_info || 'Unknown Contact',
      };

      console.log('Client data fetched:', client);
    } else {
      console.warn('No client_id found in the counsel data.');
    }


    return {counsel, client};
  } catch (error) {
    console.error('Unexpected error occurred while fetching data:', error);
    throw error;
  }
};
