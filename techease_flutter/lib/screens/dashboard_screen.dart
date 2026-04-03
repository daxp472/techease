import 'package:flutter/material.dart';

import '../models/app_user.dart';

class DashboardScreen extends StatelessWidget {
  final AppUser user;
  final void Function(int)? onQuickNavigate;

  const DashboardScreen({super.key, required this.user, this.onQuickNavigate});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          color: const Color(0xFF0F766E),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Welcome',
                  style: TextStyle(color: Colors.white70),
                ),
                const SizedBox(height: 6),
                Text(
                  user.fullName,
                  style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  'Role: ${user.role.toUpperCase()}',
                  style: const TextStyle(color: Colors.white),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Everything you need for daily class operations from one mobile workspace.',
                  style: TextStyle(color: Colors.white70),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        const Text('Quick Actions', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
        const SizedBox(height: 12),
        Wrap(
          runSpacing: 10,
          spacing: 10,
          children: [
            _ActionTile(
              title: 'Go to Classes',
              subtitle: 'Open class details and roster',
              icon: Icons.class_outlined,
              onTap: () => onQuickNavigate?.call(1),
            ),
            _ActionTile(
              title: 'Go to Students',
              subtitle: 'Search and open student profiles',
              icon: Icons.groups_2_outlined,
              onTap: () => onQuickNavigate?.call(2),
            ),
            _ActionTile(
              title: 'Take Attendance',
              subtitle: 'Mark, review, and submit',
              icon: Icons.fact_check_outlined,
              onTap: () => onQuickNavigate?.call(4),
            ),
            _ActionTile(
              title: 'View Analytics',
              subtitle: 'Track class performance signals',
              icon: Icons.auto_graph,
              onTap: () => onQuickNavigate?.call(3),
            ),
          ],
        ),
        const SizedBox(height: 16),
        const Text('Quick Overview', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
        const SizedBox(height: 12),
        const Wrap(
          runSpacing: 10,
          spacing: 10,
          children: [
            _StatTile(title: 'Attendance', subtitle: 'Mark class attendance fast'),
            _StatTile(title: 'Classes', subtitle: 'Browse class sections'),
            _StatTile(title: 'Students', subtitle: 'Search roster details'),
            _StatTile(title: 'Insights', subtitle: 'Use analytics to justify impact'),
          ],
        )
      ],
    );
  }
}

class _ActionTile extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;

  const _ActionTile({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 170,
      child: Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, color: const Color(0xFF0F766E)),
                const SizedBox(height: 8),
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text(subtitle, style: const TextStyle(color: Colors.black54, fontSize: 12)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  final String title;
  final String subtitle;

  const _StatTile({required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 170,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Text(subtitle, style: const TextStyle(color: Colors.black54, fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }
}
