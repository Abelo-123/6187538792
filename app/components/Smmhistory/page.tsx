"use client";
import { List, Section } from "@telegram-apps/telegram-ui";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import axios from "axios";
import { useNot } from '../StatusContext';
import { useUser } from "../UserContext";
import MyLoader from "../Loader/page";

const Smmhistory = () => {

    const [loader, setLoader] = useState(false)
    const { userData } = useUser();
    const delay = (ms: number) => new Promise(resolve => {
        const interval = setInterval(() => {
            clearInterval(interval);
            resolve(true);
        }, ms);
    });

    const { useNotification, setNotification } = useNot();

    const [data, setData] = useState<any[]>([]); // Adjust the type based on your data structure
    // Fetch order status for each order
    const fetchOrderStatus = async (orderId: string) => {
        await delay(3000); // Wait for 2 seconds

        // Find the current status of the order from the state (data array)
        const currentStatus = data.find((item) => item.oid === orderId)?.status;

        // If the status is already "Completed", skip the API call
        if (currentStatus === "Completed") {
            console.log(`Skipping API call for order ${orderId}, status is already 'Completed'.`);
            return; // Exit the function early, skipping the API request
        }

        const url = `'../../api/smm/fetchStatus`; // Same URL, but we're using POST

        // Simulating a 2-second delay before making the API call


        try {

            // Sending the orderId in the request body using POST
            const response = await axios.post(url, {
                orderId: orderId, // Sending orderId as JSON in the body
            });

            const result = response.data; // Axios response contains data directly

            // Assuming the result is structured like { orderId: { status: "someStatus", ... }}
            if (result[orderId]) {
                const { status, charge, start_count, remains, currency } = result[orderId];

                // If the response contains status for the given orderId, update the relevant data
                setData((prevData) =>
                    prevData.map((item) =>
                        item.oid === orderId
                            ? { ...item, status, charge, start_count, remains, currency } // Update relevant fields
                            : item
                    )
                );
            }
        } catch (error) {
            console.error("Failed to fetch order status:", error);
            if (axios.isAxiosError(error)) {
                console.error("Axios error:", error.response?.data || error.message);
            }
        }
    };


    useEffect(() => {
        const auth = async () => {
            setLoader(true)
            // Fetch the initial data (orders) from Supabase or any other source
            const { data: initialData, error } = await supabase
                .from("orders")
                .select("*")
                .eq("uid", userData.userId); // Filter by user id or another parameter as needed

            if (error) {
                console.log(error);
            } else {
                setData(initialData); // Set the initial data
                setLoader(false)
                // Immediately call fetchOrderStatus for each order to fetch the initial status
                initialData.forEach((item) => {
                    // Ensure we're only fetching for orders that are not "Completed" or "Cancelled"
                    if (item.status !== "Completed" && item.status !== "Canceled") {
                        fetchOrderStatus(item.oid); // Fetch status immediately for non-completed orders
                    }
                });

                // Create intervals for polling, only for non-completed or non-cancelled orders
                const intervals = initialData
                    .filter((item) => item.status !== "Completed" && item.status !== "Canceled") // Filter out completed/cancelled orders
                    .map((item) => {

                        return setInterval(() => fetchOrderStatus(item.oid), 2000000); // Polling only for non-completed orders every 2 seconds
                    });

                // Cleanup intervals when the component unmounts or when data changes
                return () => {
                    intervals.forEach(clearInterval); // Clear all intervals
                };
            }
        };

        auth(); // Call the auth function when the component is mounted
    }, []); // Empty dependency array ensures this effect runs only once after initial render
    // Empty dependency array ensures this effect runs only once on mount

    useEffect(() => {
        // Create a real-time channel for the 'orders' table
        const channel = supabase
            .channel("orders_channel")
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
                //console.log("New order inserted:", payload.new);
                // Add the new order to the state
                setData((prevData) => [payload.new, ...prevData]);

                // If the new order status is not "Completed", call fetchOrderStatus
                if (payload.new.status !== "Completed") {
                    fetchOrderStatus(payload.new.oid); // Fetch status for new order
                }
            })
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
                //console.log("Order updated:", payload.new.status, "for oid", payload.new.oid);

                // Find the updated order in the current state
                setData((prevData) =>
                    prevData.map((item) =>
                        item.oid === payload.new.oid
                            ? { ...item, status: payload.new.status, start_count: payload.new.start_from, remains: payload.new.remains } // Update the status in the state
                            : item
                    )
                );

                // If the updated order's status is not "Completed", call fetchOrderStatus
                if (payload.new.status !== "Completed") {
                    fetchOrderStatus(payload.new.oid); // Fetch status for updated order
                }
            })
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {

                //console.log(payload.new)
                if (payload.new.panel === "Completed" && useNotification.order == false) {
                    console.log(payload.new.panel)
                    setNotification((prevNotification) => ({
                        ...prevNotification, // Spread the previous state
                        order: true,
                        // Update the `deposit` field
                    }));

                }
            })

            .subscribe();

        // Cleanup the subscription on component unmount
        return () => {
            channel.unsubscribe();
        };
    }, []); // Empty dependency array ensures this effect runs only once on mount

    return (
        <>

            <List
                style={{
                    padding: "20px 0px",
                }}
            >
                <Section header="Order History" style={{ border: "1px solid var(--tgui--section_bg_color)" }}>
                    <div style={{ width: "95%" }} className="mx-auto">
                        {loader && <MyLoader />}
                        <div style={{ borderRadius: "10px" }} className="bg-red-100 w-full overflow-x-auto">
                            <ul>
                                {!loader &&
                                    <table style={{ width: "100%" }} className="border border-gray-200 rounded-lg shadow-md">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                                    Status
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">ID</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                                    Starting From
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Remains</th>

                                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                                    Quantity
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Link</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                                    Charge (ETB)
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Service</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {data.map((items, index) => (
                                                <tr key={index}>
                                                    <td className="px-6 py-4 text-sm text-white">{items.status}</td>
                                                    <td className="px-6 py-4 text-sm text-white">{items.oid}</td>
                                                    <td className="px-6 py-4 text-sm text-white">{items.start_count}</td>
                                                    <td className="px-6 py-4 text-sm text-white">{items.remains}</td>
                                                    <td className="px-6 py-4 text-sm text-white">{items.quantity}</td>
                                                    <td className="px-6 py-4 text-sm text-white">{items.link}</td>
                                                    <td className="px-6 py-4 text-sm text-white">{items.charge}</td>
                                                    <td className="px-6 py-4 text-sm text-white">{items.service}</td>
                                                    <td className="px-6 py-4 text-sm text-white">{items.date}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                }
                            </ul>


                        </div>
                    </div>
                </Section>
            </List>
        </>
    );
};

export default Smmhistory;
