import { BarChart, PieChart, ScatterChart } from "@mantine/charts";
import {
	Button,
	Container,
	Flex,
	Grid,
	Group,
	Loader,
	LoadingOverlay,
	Menu,
	Modal,
	NumberInput,
	Paper,
	SimpleGrid,
	Stack,
	Text,
} from "@mantine/core";
import { DatePicker } from "@mantine/dates";
import { useInViewport } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { LoaderFunctionArgs, MetaArgs } from "@remix-run/node";
import {
	DailyUserActivitiesDocument,
	DailyUserActivitiesResponseGroupedBy,
	type FitnessAnalytics,
	FitnessAnalyticsDocument,
} from "@ryot/generated/graphql/backend/graphql";
import {
	changeCase,
	formatDateToNaiveDate,
	humanizeDuration,
	isBoolean,
	mapValues,
	pickBy,
	snakeCase,
} from "@ryot/ts-utils";
import { IconDeviceFloppy, IconImageInPicture } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import html2canvas from "html2canvas";
import { produce } from "immer";
import { type ReactNode, useRef, useState } from "react";
import { match } from "ts-pattern";
import { useLocalStorage } from "usehooks-ts";
import { z } from "zod";
import {
	MediaColors,
	clientGqlService,
	convertUtcHourToLocalHour,
	dayjsLib,
	queryFactory,
	selectRandomElement,
} from "~/lib/generals";
import { useGetMantineColors, useUserPreferences } from "~/lib/hooks";

const TIME_RANGES = [
	"Yesterday",
	"Past 7 Days",
	"Past 30 Days",
	"Past 6 Months",
	"Past 12 Months",
	"This Week",
	"This Month",
	"This Year",
	"All Time",
	"Custom",
] as const;

const timeSpanSettingsSchema = z.object({
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	range: z.enum(TIME_RANGES),
});

export type TimeSpanSettings = z.infer<typeof timeSpanSettingsSchema>;

const getStartTime = (range: (typeof TIME_RANGES)[number]) =>
	match(range)
		.with("Yesterday", () => dayjsLib().subtract(1, "day"))
		.with("This Week", () => dayjsLib().startOf("week"))
		.with("This Month", () => dayjsLib().startOf("month"))
		.with("This Year", () => dayjsLib().startOf("year"))
		.with("Past 7 Days", () => dayjsLib().subtract(7, "day"))
		.with("Past 30 Days", () => dayjsLib().subtract(30, "day"))
		.with("Past 6 Months", () => dayjsLib().subtract(6, "month"))
		.with("Past 12 Months", () => dayjsLib().subtract(12, "month"))
		.with("All Time", () => dayjsLib().subtract(2000, "year"))
		.with("Custom", () => undefined)
		.exhaustive();

export const loader = async (_args: LoaderFunctionArgs) => {
	return {};
};

export const meta = (_args: MetaArgs<typeof loader>) => {
	return [{ title: "Fitness Analytics | Ryot" }];
};

const useTimeSpanSettings = () => {
	const [timeSpanSettings, setTimeSpanSettings] =
		useLocalStorage<TimeSpanSettings>("TimeSpanSettings", {
			range: "Past 30 Days",
		});
	const startDate =
		timeSpanSettings.startDate ||
		formatDateToNaiveDate(getStartTime(timeSpanSettings.range) || new Date());

	const endDate = timeSpanSettings.endDate || formatDateToNaiveDate(dayjsLib());
	return { timeSpanSettings, setTimeSpanSettings, startDate, endDate };
};

export default function Page() {
	const [customRangeOpened, setCustomRangeOpened] = useState(false);
	const [isCaptureLoading, setIsCaptureLoading] = useState(false);
	const toCaptureRef = useRef<HTMLDivElement>(null);
	const { timeSpanSettings, setTimeSpanSettings, startDate, endDate } =
		useTimeSpanSettings();

	return (
		<>
			<CustomDateSelectModal
				opened={customRangeOpened}
				onClose={() => setCustomRangeOpened(false)}
			/>
			<Container
				py="md"
				ref={toCaptureRef}
				style={{ backgroundColor: "var(--mantine-color-body)" }}
			>
				<Stack>
					<SimpleGrid cols={{ base: 2 }} style={{ alignItems: "center" }}>
						<Text fz={{ base: "lg", md: "h1" }} fw="bold">
							Analytics
						</Text>
						<Menu position="bottom-end">
							<Menu.Target>
								<Button w={{ md: 200 }} variant="default" ml={{ md: "auto" }}>
									<Stack gap={0}>
										<Text size="xs">{timeSpanSettings.range}</Text>
										{timeSpanSettings.range !== "All Time" ? (
											<Text span c="dimmed" size="xs">
												{startDate} - {endDate}
											</Text>
										) : null}
									</Stack>
								</Button>
							</Menu.Target>
							<Menu.Dropdown>
								{TIME_RANGES.map((range) => (
									<Menu.Item
										ta="right"
										key={range}
										color={
											timeSpanSettings.range === range ? "blue" : undefined
										}
										onClick={() => {
											if (range === "Custom") {
												setCustomRangeOpened(true);
												return;
											}
											setTimeSpanSettings(
												produce(timeSpanSettings, (draft) => {
													draft.range = range;
													draft.startDate = undefined;
													draft.endDate = undefined;
												}),
											);
										}}
									>
										{range}
									</Menu.Item>
								))}
							</Menu.Dropdown>
						</Menu>
					</SimpleGrid>
					<Grid>
						<Grid.Col span={{ base: 12, md: 6 }}>
							<MusclesChart />
						</Grid.Col>
						<Grid.Col span={{ base: 12, md: 6 }}>
							<ExercisesChart />
						</Grid.Col>
						<Grid.Col span={{ base: 12, md: 6 }}>
							<TimeOfDayChart />
						</Grid.Col>
						<Grid.Col span={12}>
							<ActivitySection />
						</Grid.Col>
					</Grid>
				</Stack>
			</Container>
			<Flex w="100%" mt="md">
				<Button
					mr="md"
					ml="auto"
					variant="default"
					loading={isCaptureLoading}
					leftSection={<IconImageInPicture />}
					onClick={async () => {
						if (!toCaptureRef.current) return;
						setIsCaptureLoading(true);
						try {
							const canvasPromise = await html2canvas(toCaptureRef.current);
							const dataURL = canvasPromise.toDataURL("image/png");
							const img = new Image();
							img.setAttribute("src", dataURL);
							img.setAttribute("download", dataURL);
							const a = document.createElement("a");
							a.setAttribute("download", dataURL);
							a.setAttribute("href", img.src);
							a.setAttribute("target", "_blank");
							a.innerHTML = "DOWNLOAD";
							document.body.appendChild(a);
							a.click();
						} catch {
							notifications.show({
								color: "red",
								title: "Error",
								message: "Something went wrong while capturing the image",
							});
						} finally {
							setIsCaptureLoading(false);
						}
					}}
				>
					Save image
				</Button>
			</Flex>
		</>
	);
}

const DisplayStat = (props: {
	label: string;
	value: string | number;
}) => {
	return (
		<Stack gap={4}>
			<Text c="dimmed">{props.label}</Text>
			<Text size="xl" fw="bolder">
				{props.value}
			</Text>
		</Stack>
	);
};

const ActivitySection = () => {
	const { ref, inViewport } = useInViewport();
	const { startDate, endDate } = useTimeSpanSettings();
	const { data: dailyUserActivitiesData } = useQuery({
		queryKey: queryFactory.miscellaneous.dailyUserActivities(startDate, endDate)
			.queryKey,
		enabled: inViewport,
		queryFn: async () => {
			const { dailyUserActivities } = await clientGqlService.request(
				DailyUserActivitiesDocument,
				{ input: { dateRange: { startDate, endDate } } },
			);
			const trackSeries = mapValues(MediaColors, () => false);
			const data = dailyUserActivities.items.map((d) => {
				const data = Object.entries(d)
					.filter(([_, value]) => value !== 0)
					.map(([key, value]) => ({
						[snakeCase(
							key.replace("Count", "").replace("total", ""),
						).toUpperCase()]: value,
					}))
					.reduce(Object.assign, {});
				for (const key in data)
					if (isBoolean(trackSeries[key])) trackSeries[key] = true;
				return data;
			});
			const series = pickBy(trackSeries);
			return {
				data,
				series,
				groupedBy: dailyUserActivities.groupedBy,
				totalCount: dailyUserActivities.totalCount,
				totalDuration: dailyUserActivities.totalDuration,
			};
		},
	});
	const items = dailyUserActivitiesData?.totalCount || 0;

	return (
		<Stack ref={ref} pos="relative" h={{ base: 500, md: 400 }}>
			<LoadingOverlay
				visible={!dailyUserActivitiesData}
				zIndex={1000}
				overlayProps={{ radius: "md", blur: 3 }}
			/>
			<SimpleGrid cols={{ base: 2, md: 3 }} mx={{ md: "xl" }}>
				<DisplayStat
					label="Total"
					value={`${new Intl.NumberFormat("en-US", {
						notation: "compact",
					}).format(Number(items))} items`}
				/>
				<DisplayStat
					label="Duration"
					value={
						dailyUserActivitiesData
							? humanizeDuration(
									dayjsLib
										.duration(dailyUserActivitiesData.totalDuration, "minutes")
										.asMilliseconds(),
									{ largest: 2 },
								)
							: "N/A"
					}
				/>
			</SimpleGrid>
			{dailyUserActivitiesData && dailyUserActivitiesData.totalCount !== 0 ? (
				<BarChart
					h="100%"
					ml={-15}
					withLegend
					tickLine="x"
					dataKey="DAY"
					type="stacked"
					data={dailyUserActivitiesData.data}
					legendProps={{ verticalAlign: "bottom" }}
					series={Object.keys(dailyUserActivitiesData.series).map((lot) => ({
						name: lot,
						color: MediaColors[lot],
						label: changeCase(lot),
					}))}
					xAxisProps={{
						tickFormatter: (v) =>
							dayjsLib(v).format(
								match(dailyUserActivitiesData.groupedBy)
									.with(DailyUserActivitiesResponseGroupedBy.Day, () => "MMM D")
									.with(DailyUserActivitiesResponseGroupedBy.Month, () => "MMM")
									.with(
										DailyUserActivitiesResponseGroupedBy.Year,
										DailyUserActivitiesResponseGroupedBy.Millennium,
										() => "YYYY",
									)
									.exhaustive(),
							),
					}}
				/>
			) : (
				<Paper withBorder h="100%" w="100%" display="flex">
					<Text m="auto" ta="center">
						No activity found in the selected period
					</Text>
				</Paper>
			)}
		</Stack>
	);
};

const CustomDateSelectModal = (props: {
	opened: boolean;
	onClose: () => void;
}) => {
	const { timeSpanSettings, setTimeSpanSettings, startDate, endDate } =
		useTimeSpanSettings();
	const [value, setValue] = useState<[Date | null, Date | null]>([
		new Date(startDate),
		new Date(endDate),
	]);

	return (
		<Modal
			opened={props.opened}
			title="Select custom date range"
			onClose={props.onClose}
		>
			<Stack>
				<DatePicker
					mx="auto"
					size="md"
					type="range"
					value={value}
					w="fit-content"
					onChange={setValue}
				/>
				<Button
					variant="default"
					leftSection={<IconDeviceFloppy />}
					onClick={() => {
						setTimeSpanSettings(
							produce(timeSpanSettings, (draft) => {
								draft.startDate = formatDateToNaiveDate(value[0] || new Date());
								draft.endDate = formatDateToNaiveDate(value[1] || new Date());
								draft.range = "Custom";
							}),
						);
						props.onClose();
					}}
				>
					Apply
				</Button>
			</Stack>
		</Modal>
	);
};

const MusclesChart = () => {
	const colors = useGetMantineColors();

	return (
		<ChartContainer title="Muscles worked out">
			{(data, count) => ({
				totalItems: data.workoutMuscles.length,
				render: (
					<PieChart
						size={250}
						withLabels
						withTooltip
						strokeWidth={0.5}
						labelsType="percent"
						tooltipDataSource="segment"
						data={data.workoutMuscles.slice(0, count).map((item) => ({
							value: item.count,
							name: changeCase(item.muscle),
							color: selectRandomElement(colors, item.muscle),
						}))}
					/>
				),
			})}
		</ChartContainer>
	);
};

const ExercisesChart = () => {
	const colors = useGetMantineColors();

	return (
		<ChartContainer title="Exercises done">
			{(data, count) => ({
				totalItems: data.workoutExercises.length,
				render: (
					<BarChart
						h={300}
						withTooltip
						dataKey="name"
						gridAxis="none"
						tickLine="none"
						tooltipAnimationDuration={500}
						series={[{ name: "value", label: "Times done" }]}
						data={data.workoutExercises.slice(0, count).map((item) => ({
							value: item.count,
							name: changeCase(item.exercise),
							color: selectRandomElement(colors, item.exercise),
						}))}
					/>
				),
			})}
		</ChartContainer>
	);
};

const TimeOfDayChart = () => {
	return (
		<ChartContainer title="Time of day" disableCounter>
			{(data) => {
				const hours = data.hours.map((h) => ({
					Count: h.count,
					Hour: convertUtcHourToLocalHour(h.hour),
				}));
				return {
					totalItems: hours.length,
					render: (
						<ScatterChart
							h={300}
							unit={{ x: "h" }}
							dataKey={{ x: "Hour", y: "Count" }}
							data={[{ color: "blue.5", name: "Group 1", data: hours }]}
						/>
					),
				};
			}}
		</ChartContainer>
	);
};

type ChartContainerProps = {
	title: string;
	disableCounter?: boolean;
	children: (
		data: FitnessAnalytics,
		count: number,
	) => {
		render: ReactNode;
		totalItems: number;
	};
};

const ChartContainer = (props: ChartContainerProps) => {
	const userPreferences = useUserPreferences();
	const { startDate, endDate } = useTimeSpanSettings();
	const [count, setCount] = useLocalStorage(
		`FitnessChartContainer-${props.title}`,
		10,
	);
	const input = { startDate, endDate };

	const { data: fitnessAnalytics } = useQuery({
		queryKey: queryFactory.analytics.fitness({ input }).queryKey,
		queryFn: async () => {
			return await clientGqlService
				.request(FitnessAnalyticsDocument, { input })
				.then((data) => data.fitnessAnalytics);
		},
	});

	const value = fitnessAnalytics
		? props.children(fitnessAnalytics, count)
		: undefined;

	return userPreferences.featuresEnabled.fitness.enabled ? (
		<Paper display="flex" h={380} withBorder={value?.totalItems === 0} p="md">
			<Flex flex={1} align="center" direction="column">
				<Group wrap="nowrap" w="100%" gap="xl" justify="center">
					<Text size="lg" fw="bold">
						{props.title}
					</Text>
					{props.disableCounter || (value?.totalItems || 0) === 0 ? null : (
						<NumberInput
							w={60}
							min={2}
							size="xs"
							value={count}
							max={value?.totalItems}
							onFocus={(e) => e.target.select()}
							onChange={(v) => setCount(Number(v))}
						/>
					)}
				</Group>
				<Flex flex={1} w="100%" justify="center" align="center">
					{value ? (
						value.totalItems > 0 ? (
							value.render
						) : (
							<Text fz="lg" mt="xl">
								No data found
							</Text>
						)
					) : (
						<Loader />
					)}
				</Flex>
			</Flex>
		</Paper>
	) : null;
};
